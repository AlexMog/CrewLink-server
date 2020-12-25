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
import {Messenger} from "./messaging/Messenger";
import {RabbitmqMessenger} from "./messaging/RabbitmqMessenger";
import {Player} from "./model/Player";

// TODO This needs to have a rework using preferably MVC models instead

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

// NOTE: You can use your own implementation of messenger or cache, here, Redis and RabbitMQ are the default ones
const cache: Cache = new RedisCache(process.env.REDIS_URL!);
const messenger: Messenger = new RabbitmqMessenger(process.env.RABBITMQ_URL!);

const serverId = v4();

interface Signal {
	data: string;
	to: string;
}

app.set('view engine', 'pug')
app.use(morgan('combined'))
app.use(express.static('offsets'))
let connectionCount = 0;
let address = process.env.ADDRESS;

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
})


io.on('connection', (socket: socketIO.Socket) => {
	connectionCount++;
	logger.info("Total connected: %d", connectionCount);
	let player: Player = {
		roomId: undefined,
		serverId: serverId,
		clientId: undefined,
		id: socket.id,
	};

	socket.on('join', async (code: string, id: number) => {
		if (typeof code !== 'string' || typeof id !== 'number') {
			socket.disconnect();
			logger.error(`Socket %s sent invalid join command: %s %d`, socket.id, code, id);
			return;
		}
		player.roomId = code;

		const playersInRoom = await cache.retrieveRoomPlayers(code);
		let ids: any = {};
		for (const player of playersInRoom) {
			ids[player.id] = player.clientId;
		}
		socket.emit('setIds', ids);

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
		logger.info("Total connected: %d", connectionCount);
	})

})

server.listen(port);
(async () => {
	if (!address)
		address = `http://${await publicIp.v4()}:${port}`;
	logger.info('CrewLink Server started: %s', address);
})();
