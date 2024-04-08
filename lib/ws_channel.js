export default class WsChannel {
  constructor({ws, channelName, onReceive, onConnect, acts}) {
    this.ws = ws;
    this.channelName = channelName;
    //this.onReceive = onReceive;
    this.onConnect = onConnect;
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

  disconnect(silent) {
    this.ws._leaveChannel(this, !silent);
  }

  _execute(method, data, props = {}) {
    const command = `${method}|${new Date().getTime()}|${Math.random()}`;
    const commandUpperCase = command.toUpperCase();
    return new Promise((success, reject) => {
      this._queries[commandUpperCase] = { success, reject };
      this.send({ COMMAND: command, DATA: data }, props.force);
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
    return this.ws._send(this, data, force);
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
