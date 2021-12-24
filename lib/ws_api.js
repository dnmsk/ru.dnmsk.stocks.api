import WsChannel from './ws_channel';

export default class WsApi {
  constructor(ws, onConnected) {
    this.queries = {};
    this.channel = new WsChannel(ws, "API", data => {
      if (data.command) {
        const commandUpperCase = data.command.toUpperCase();
        const responseObj = this.queries[commandUpperCase];
        if (responseObj) {
          if (data.data.success === false) {
            responseObj.reject(data.data);
          } else {
            responseObj.success(data.data);
          }
          delete this.queries[commandUpperCase];
        }
      }
    }, onConnected);
    this.channel.channelID = 0;
  }

  _execute(method, target, data, props = {}) {
    const command = `${method}|${target}|${new Date().getTime()}|${Math.random()}`;
    const commandUpperCase = command.toUpperCase();
    return new Promise((success, reject) => {
      this.queries[commandUpperCase] = { success, reject };
      this.channel.send({ command, data }, props.force);
      const timeoutError = () => {
        if (this.queries[commandUpperCase]) {
          delete this.queries[commandUpperCase];
          reject();
        }
      };
      setTimeout(timeoutError, props.timeout || 30 * 60 * 1000);
    });
  }

  get(target, data, props) {
    return this._execute('GET', target, data, props);
  }

  post(target, data, props) {
    return this._execute('POST', target, data, props);
  }

  put(target, data, props) {
    return this._execute('PUT', target, data, props);
  }

  delete(target, data, props) {
    return this._execute('DELETE', target, data, props);
  }
};
