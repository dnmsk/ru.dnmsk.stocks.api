import wsChannel from './ws_channel';

export default class WsApi {
  constructor(ws, onConnected) {
    this.queries = {};
    this.channel = new wsChannel(ws, "API", data => {
      if (data.command) {
        let responseObj = this.queries[data.command];
        if (responseObj) {
          if (data.data.success === false) {
            responseObj.reject(data.data);
          } else {
            responseObj.success(data.data);
          }
          delete this.queries[data.command];
        }
      }
    }, onConnected);
  }

  _execute(method, target, data, props = {}) {
    var command = `${method}|${target}|${new Date().getTime()}|${Math.random()}`.toUpperCase();
    return new Promise((success, reject) => {
      this.queries[command] = { success, reject };
      this.channel.send({ command, data }, props.force);
      var timeoutError = () => {
        if (this.queries[command]) {
          delete this.queries[command];
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
