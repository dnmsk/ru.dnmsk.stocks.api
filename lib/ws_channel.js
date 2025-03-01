export default class WsChannel {
  constructor({ws, channelName, onReceive, onConnect, onDisconnect, acts}) {
    this.ws = ws;
    this.channelID = undefined;
    this.channelName = channelName;
    this._onConnect = onConnect;
    this._onDisconnect = onDisconnect;
    this.acts = acts || (() => {});
    this._queries = {};
    this._onReceive = onReceive;
  }

  onReceive(data) {
    if (data.command) {
      const commandUpperCase = data.command.toUpperCase();
      const responseObj = this._queries[commandUpperCase];
      if (responseObj) {
        if (data.success === false) {
          responseObj.reject(data.data);
        } else {
          responseObj.success(data.data);
        }
        delete this._queries[commandUpperCase];
      }
    } else {
      this._onReceive(data);
    }
  }

  disconnect() {
    return this.ws._leaveChannel(this);
  }

  _execute(method, data, props = {}) {
    const command = `${method}|${new Date().getTime()}|${Math.random()}`;
    const commandUpperCase = command.toUpperCase();
    return new Promise((success, reject) => {
      this._queries[commandUpperCase] = { success, reject };
      this.send({ COMMAND: command, DATA: data }, props.force)
        .catch(reject);
      const timeoutError = () => {
        if (this._queries[commandUpperCase]) {
          delete this._queries[commandUpperCase];
          reject();
        }
      };
      setTimeout(timeoutError, props.timeout || 30 * 60 * 1000);
    });
  }

  send(data, force = false) {
    return new Promise((success, reject) => {
      const loop = () => {
        if ((force || this.channelID !== undefined)) {
          return this.ws._send(this, data, force)
            .then(success)
            .catch(reject);
        }
        setTimeout(loop, 5);
      }
      loop();
    });
  }

  index(data, props) {
    return this._execute('INDEX', data, props);
  }

  show(data, props) {
    return this._execute('SHOW', data, props);
  }

  post(data, props) {
    return this._execute('POST', data, props);
  }

  put(data, props) {
    return this._execute('PUT', data, props);
  }

  delete(data, props) {
    return this._execute('DELETE', data, props);
  }
};
