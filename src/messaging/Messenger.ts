export interface Message {
  command: string;
  args: Array<any>;
}

export abstract class Messenger {
  protected listeners: Array<(message: Message) => void> = [];

  /**
   * Send a message to a specific player
   * @param playerId The player's session id
   * @param message The message to send (will be serialized to JSON)
   */
  abstract async sendToPlayer(playerId: string, message: Message): Promise<void>;

  /**
   * Broadcast a message to a specific room
   * @param roomId The room's id
   * @param message The message to send (will be serialized to JSON)
   */
  abstract async broadcastToRoom(roomId: string, message: Message): Promise<void>;

  addListener(listener: (message: Message) => void): void {
    this.listeners.push(listener);
  }

  protected dispatchMessage(message: Message): void {
    this.listeners.forEach(listener => listener(message));
  }
}
