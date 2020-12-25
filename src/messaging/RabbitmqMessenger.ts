import {Message, Messenger} from "./Messenger";

export class RabbitmqMessenger extends Messenger {
  constructor(rabbitmqUrl: string) {
    super();
  }

  async broadcastToRoom(roomId: string, message: Message): Promise<void> {
    return Promise.resolve(undefined);
  }

  async sendToPlayer(playerId: string, message: Message): Promise<void> {
    return Promise.resolve(undefined);
  }
}
