import {Message, Messenger} from "./Messenger";

export class LocalMessenger extends Messenger {
  async broadcastToRoom(roomId: string, message: Message): Promise<void> {
    this.dispatchMessage({
      to: roomId,
      ...message
    });
  }

  async sendToPlayer(playerId: string, message: Message): Promise<void> {
    this.dispatchMessage({
      to: playerId,
      ...message
    })
  }
}
