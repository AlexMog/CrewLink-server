import express from 'express';
import { Server } from 'http';
import { Server as HttpsServer } from 'https';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import socketIO from 'socket.io';
import Tracer from 'tracer';
import morgan from 'morgan';
import publicIp from 'public-ip';
import { v4 } from "uuid";
import {Cache} from "./cache/Cache";
import {RedisCache} from "./cache/RedisCache";
import {RabbitmqMessenger} from "./messaging/RabbitmqMessenger";
import {Player} from "./model/Player";
import {LocalCache} from "./cache/LocalCache";
import {LocalMessenger} from "./messaging/LocalMessenger";

// TODO This needs to have a rework using preferably MVC models instead

(async function() {
	const httpsEnabled = !!process.env.HTTPS;

	const port = parseInt(process.env.PORT || (httpsEnabled ? '443' : '9736'));

	const sslCertificatePath = process.env.SSLPATH || process.cwd();
	const supportedVersions = readdirSync(join(process.cwd(), 'offsets')).map(file => file.replace('.yml', ''));

	const logger = Tracer.colorConsole({
		format: "{{timestamp}} <{{title}}> {{message}}"
	});

	const app = express();
	let server: HttpsServer | Server;
	if (httpsEnabled) {
		server = new HttpsServer({
			key: readFileSync(join(sslCertificatePath, 'privkey.pem')),
			cert: readFileSync(join(sslCertificatePath, 'fullchain.pem'))
		}, app);
	} else {
		server = new Server(app);
	}
	const io = socketIO(server);

	const serverId = v4();
	// Comment this part and uncomment next part to activate cluster mode
	// NOTE: This part replicate a local, non-clustered server
	const cache = new LocalCache();
	const messenger = new LocalMessenger();
	// Uncomment this part if you want to activate the cluster mode
	// NOTE: You can use your own implementation of messenger or cache, here, Redis and RabbitMQ are the default ones
	//	const cache: Cache = new RedisCache(process.env.REDIS_URL!);
	//	const messenger = new RabbitmqMessenger(process.env.RABBITMQ_URL!, cache, serverId);
	//	await messenger.connect();

	interface Signal {
		data: string;
		to: string;
	}

	app.set('view engine', 'pug')
	app.use(morgan('combined'))
	app.use(express.static('offsets'))
	let connectionCount = 0;
	let address = process.env.ADDRESS;

	messenger.addListener(message => {
		io.to(message.to).emit(message.command, ...message.args);
	});

	app.get('/', (_, res) => {
		res.render('index', { connectionCount, address });
	});

	app.get('/health', (req, res) => {
		res.json({
			uptime: process.uptime(),
			connectionCount,
			address,
			name: process.env.NAME,
			supportedVersions
		});
	});

	io.on('connection', (socket: socketIO.Socket) => {
		connectionCount++;
		logger.info("Total connected: %d", connectionCount);
		let player: Player = {
			roomId: undefined,
			serverId: serverId,
			clientId: undefined,
			id: socket.id,
		};
		let sessionCreated = false;

		socket.on('join', async (code: string, id: number) => {
			if (typeof code !== 'string' || typeof id !== 'number') {
				socket.disconnect();
				logger.error(`Socket %s sent invalid join command: %s %d`, socket.id, code, id);
				return;
			}

			if (!sessionCreated) {
				sessionCreated = true;
				await cache.updateSession(socket.id, serverId);
			}

			// NOTE: This part might need a cluster-wide lock to avoid race conditions with other nodes
			const playersInRoom = await cache.retrieveRoomPlayers(code);
			let ids: any = {};
			for (const player of playersInRoom) {
				ids[player.id] = player.clientId;
			}
			socket.emit('setIds', ids);

			player.roomId = code;
			socket.join(code);
			await cache.addPlayerToRoom(player.roomId, player);
			await messenger.broadcastToRoom(player.roomId, {
				command: "join",
				args: [socket.id, id],
			});
		});

		socket.on('id', async (id: number) => {
			if (typeof id !== 'number') {
				socket.disconnect();
				logger.error(`Socket %s sent invalid id command: %d`, socket.id, id);
				return;
			}

			player.clientId = id;
			if (!player.roomId) {
				socket.disconnect();
				logger.error('Socket %s is not a in room.', socket.id);
				return;
			}

			// Cache player update
			await cache.addPlayerToRoom(player.roomId, player);
			await messenger.broadcastToRoom(player.roomId, {
				command: "setId",
				args: [id],
			});
		});


		socket.on('leave', () => {
			if (player.roomId) socket.leave(player.roomId);
		})

		socket.on('signal', async (signal: Signal) => {
			if (typeof signal !== 'object' || !signal.data || !signal.to || typeof signal.to !== 'string') {
				socket.disconnect();
				logger.error(`Socket %s sent invalid signal command: %j`, socket.id, signal);
				return;
			}

			const { to, data } = signal;
			await messenger.sendToPlayer(to, {
				command: "signal",
				args: [
					{
						data,
						from: socket.id
					}
				]
			});
		});

		socket.on('disconnect', () => {
			connectionCount--;
			if (player.roomId) {
				cache.removePlayerFromRoom(player.roomId, player.id);
			}
			cache.clearSession(socket.id);
			logger.info("Total connected: %d", connectionCount);
		})

	})

	server.listen(port);
	if (!address)
		address = `http://${await publicIp.v4()}:${port}`;
	logger.info('CrewLink Server started: %s', address);
})();
