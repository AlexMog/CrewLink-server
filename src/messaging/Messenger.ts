export interface Message {
  command: string;
  args: Array<any>;
}

export interface ReceivedMessage extends Message {
  to: string;
}

export abstract class Messenger {
  protected listeners: Array<(message: Message) => void> = [];

  /**
   * Send a message to a specific player
   * @param playerId The player's session id
   * @param message The message to send (will be serialized to JSON)
   */
  abstract sendToPlayer(playerId: string, message: Message): Promise<void>;

  /**
   * Broadcast a message to a specific room
   * @param roomId The room's id
   * @param message The message to send (will be serialized to JSON)
   */
  abstract broadcastToRoom(roomId: string, message: Message): Promise<void>;

  addListener(listener: (message: ReceivedMessage) => void): void {
    this.listeners.push(listener);
  }

  protected dispatchMessage(message: ReceivedMessage): void {
    this.listeners.forEach(listener => listener(message));
  }
}
