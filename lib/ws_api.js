import WsChannel from './ws_channel';

export default class WsApi {
  constructor({ws, onConnect}) {
    this.channel = new WsChannel({
      ws,
      channelName: 'API',
      onReceive: (data) => console.log(['unknown onReceive call', data]),
      onConnect
    });
    this.channel.channelID = 0;
  }

  index(target, data, props) {
    return this.channel.index({ target, data, method: 'INDEX' }, props);
  }

  get(target, data, props) {
    //obsolete
    return this.channel.show('GET', { target, data, method: 'GET' }, props);
  }

  show(target, data, props) {
    return this.channel.show({ target, data, method: 'SHOW' }, props);
  }

  post(target, data, props) {
    return this.channel.post({ target, data, method: 'POST' }, props);
  }

  put(target, data, props) {
    return this.channel.put({ target, data, method: 'PUT' }, props);
  }

  delete(target, data, props) {
    return this.channel.delete({ target, data, method: 'DELETE' }, props);
  }
};
