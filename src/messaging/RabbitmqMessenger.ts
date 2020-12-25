import {Message, Messenger} from "./Messenger";
import Amqp from "amqplib";
import {Cache} from "../cache/Cache";
import {Player} from "../model/Player";

export class RabbitmqMessenger extends Messenger {
  private readonly EXCHANGE_NAME = process.env.AMQP_EXCHANGE_NAME || "crewlink:messaging";
  private connection: Amqp.Connection;
  private channel: Amqp.Channel;

  constructor(private rabbitmqUrl: string, private cache: Cache, private serverId: string) {
    super();
  }

  async connect() {
    this.connection = await Amqp.connect(this.rabbitmqUrl);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(this.EXCHANGE_NAME, "direct", {
      durable: true,
    });
    const queue = await this.channel.assertQueue('', {
      exclusive: true,
    });
    await this.channel.bindQueue(queue.queue, this.EXCHANGE_NAME, this.serverId);
    await this.channel.consume(queue.queue, msg => {
      this.dispatchMessage(JSON.parse(msg.content.toString()));
    });
  }

  async broadcastToRoom(roomId: string, message: Message): Promise<void> {
    const promises: Promise<void>[] = [];
    (await this.cache.retrieveRoomPlayers(roomId)).forEach(player => {
      promises.push(this.sendTo(player, message));
    });
    await Promise.all(promises);
  }

  private async sendTo(player: Player, message: Message): Promise<void> {
    this.channel.publish(this.EXCHANGE_NAME, player.serverId, Buffer.from(JSON.stringify({
      to: player.id,
      ...message
    })));
  }

  async sendToPlayer(playerId: string, message: Message): Promise<void> {
    const session = await this.cache.getSession(playerId);
    if (session) {
      this.channel.publish(this.EXCHANGE_NAME, session, Buffer.from(JSON.stringify({
        to: playerId,
        ...message
      })));
    }
  }
}
