import wsChannel from './ws_channel';
import WsApi from './ws_api';
import pako from 'pako';

function onReadyState(ws, force) {
  return new Promise((success, reject) => {
    function loop() {
      let v = (force || ws.connected) && ws.webSocket && ws.webSocket.readyState || 0;
      switch(v) {
        case 0:
          setTimeout(loop, 5);
          break;
        case 1:
          success(ws.webSocket);
          break;
        default:
          return;
      }
    }
    loop();
  });
}

const Commands = {
  ConnectChannel: (channelName, message) => {
    let obj = {
      command: 'connectChannel',
      value: channelName
    };
    if (message) {
      message
      obj.message = message;
    }
    return JSON.stringify(obj);
  },
  SendToChannel: (channelName, message) => {
    let obj = {
      command: 'sendToChannel',
      value: channelName
    };
    if (message) {
      message
      obj.message = message;
    }
    return JSON.stringify(obj);
  },
  LeaveChannel: channelName => {
    return JSON.stringify({
      command: 'leaveChannel',
      value: channelName
    });
  },
};

function launcher(fn) {
  return new Promise((success, reject) => {
    let launch = () => fn()
      .catch(() => setTimeout(launch, 1000))
      .then(success);
    launch();
  });
}

export default class WS {
  constructor(props) {
    this.props = {
      //timeout: 1000,
      ...props
    };
    this.api = new WsApi(this, () => {
      launcher(this.props.tokenGetter).then(token => {
        let that = this;
        this.api.post("USER_CONNECTION", { token }, { force: true })
          .then(data => {
            this.connected = true;
            Object.keys(this.subscribers).forEach(key => {
              if (key == this.api.channel.channelName) {
                return;
              }
              let subscriber = this.subscribers[key];
              this.__sendToWs(Commands.ConnectChannel(subscriber.channelName));
            });
            this.props.onOpenFn && this.props.onOpenFn(data);
          });
      });
    });
    this.subscribers = { [this.api.channel.channelName]: this.api.channel };
    this._connectWS();
  }

  _connectWS() {
    this.connected = false;
    launcher(this.props.targetGetter).then(target => {
      let protocol = location.protocol == "https:" ? "wss:" : "ws:";

      this.webSocket = new WebSocket(protocol + target);
      this.webSocket.addEventListener('close', obj => this._connectWS());

      this.webSocket.addEventListener('open', obj => {
        onReadyState(this, true).then(ws => {
          this.__sendToWs(Commands.ConnectChannel(this.api.channel.channelName), true);
        });
      });

      this.webSocket.addEventListener('message', data => {
        try {
          var processMsg = msg => {
            if (!msg.channel) { return; }

            var subscriber = this.subscribers[msg.channel];
            if (subscriber) {
              if (msg.data.connected === true) {
                subscriber.onConnect && subscriber.onConnect(msg.data);
              } else {
                subscriber.onReceive(msg.data);
              }
            } else {
              this.__sendToWs(Commands.LeaveChannel(msg.channel), true);
            }
          };

          if (data.data instanceof Blob) {
            var fr = new FileReader();
            fr.onload = event => {
              var msg;
              try {
                var arr = event.target.result;
                var unpacked = pako.inflate(arr, { to: "string" });
                msg = JSON.parse(unpacked);
              } catch (ex) {
                msg = JSON.parse(data.data);
              }
              processMsg(msg);
            };
            fr.readAsArrayBuffer(data.data);
          } else {
            processMsg(JSON.parse(data.data));
          }
        } catch(ex) {
          console.log(ex);
        }
      });
    });
    //.catch();
  }

  connectChannel(channelName, data, onReceive, onConnect) {
    channelName = channelName.toUpperCase();

    if (!this.subscribers[channelName]) {
      var channel = new wsChannel(this, channelName, onReceive, onConnect);
      this.subscribers[channel.channelName] = channel;
      this.__sendToWs(Commands.ConnectChannel(channel.channelName, data));

      return channel;
    }
  }

  _leaveChannel(subscriber) {
    this.__sendToWs(Commands.LeaveChannel(subscriber.channelName));
    delete this.subscribers[subscriber.channelName];
  }

  _reconnect() {
    onReadyState(this).then(ws => ws.close());
  }

  _send(subscriber, data, force = false) {
    this.__sendToWs(Commands.SendToChannel(subscriber.channelName, data), force);
  }

  __sendToWs(data, force = false) {
    return onReadyState(this, force).then(ws => ws.send(data));
  }
};
