export default class WsChannel {
  constructor(ws, channelName, onReceive, onConnect) {
    this.ws = ws;
    this.channelName = channelName;
    this.onReceive = onReceive;
    this.onConnect = onConnect;
  }

  disconnect() {
    this.ws._leaveChannel(this);
  }

  send(data, force = false) {
    this.ws._send(this, data, force);
  }
};
