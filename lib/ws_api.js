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
    return this.channel.index({ TARGET: target, DATA: data, METHOD: 'INDEX' }, props);
  }

  show(target, data, props) {
    return this.channel.show({ TARGET: target, DATA: data, METHOD: 'SHOW' }, props);
  }

  post(target, data, props) {
    return this.channel.post({ TARGET: target, DATA: data, METHOD: 'POST' }, props);
  }

  put(target, data, props) {
    return this.channel.put({ TARGET: target, DATA: data, METHOD: 'PUT' }, props);
  }

  delete(target, data, props) {
    return this.channel.delete({ TARGET: target, DATA: data, METHOD: 'DELETE' }, props);
  }
};
