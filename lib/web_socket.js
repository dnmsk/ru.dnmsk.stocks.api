import WsChannel from './ws_channel';
import WsApi from './ws_api';
import pako from 'pako';

function onReadyState(ws, force) {
  return new Promise((success, reject) => {
    function loop() {
      const v = (force || ws.connected) && ws.webSocket && ws.webSocket.readyState || 0;
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
  ConnectChannel: ({ channelName, message }) => {
    const obj = {
      command: 'connectChannel',
      value: channelName,
    };
    if (message) {
      obj.message = message;
    }
    return JSON.stringify(obj);
  },
  SendToChannel: ({ channelName, channelID, message }) => {
    const obj = {
      command: 'sendToChannel',
      value: channelName,
      channelID,
    };
    if (message) {
      message
      obj.message = message;
    }
    return JSON.stringify(obj);
  },
  LeaveChannel: ({ channelName, channelID }) => {
    return JSON.stringify({
      command: 'leaveChannel',
      value: channelName,
      channelID,
    });
  },
};

function launcher(fn) {
  return new Promise((success, reject) => {
    const launch = () => fn()
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
        this.api.post("USER_CONNECTION", { token }, { force: true })
          .then(data => {
            this.connected = true;
            Object.keys(this.subscribers).forEach(key => {
              if (key == this.api.channel.channelName) {
                return;
              }
              const subscriber = this.subscribers[key];
              this.__sendToWs(
                Commands.ConnectChannel({
                  channelName: subscriber.channelName,
                  channelID: subscriber.channelID,
                })
              );
            });
            this.props.onOpenFn && this.props.onOpenFn(data);
          });
      });
    });
    this.subscribers = { [this.api.channel.channelName]: this.api.channel };
    this.subscribersById = { [this.api.channel.channelID]: this.api.channel };
    this._connectWS();
  }

  _connectWS() {
    this.connected = false;
    launcher(this.props.targetGetter).then(target => {
      const protocol = location.protocol == "https:" ? "wss:" : "ws:";

      this.props.target = target;
      this.webSocket = new WebSocket(protocol + target);
      this.webSocket.addEventListener('close', obj => this._connectWS());

      this.webSocket.addEventListener('open', obj => {
        onReadyState(this, true).then(ws => {
          this.__sendToWs(
            Commands.ConnectChannel({
              channelName: this.api.channel.channelName,
            }),
            true
          );
        });
      });

      this.webSocket.addEventListener('message', data => {
        try {
          const processMsg = msg => {
            //if (!msg.channelID) {
            //  return;
            //}
            if (msg.c) {
              const subscriber = this.subscribers[msg.c.toUpperCase()];
              if (subscriber) {
                this.subscribersById[msg.cid] = subscriber;
                subscriber.channelID = msg.cid;
              } else {
                this.__sendToWs(
                  Commands.LeaveChannel({ channelName: msg.c, channelID: msg.cid }),
                  true
                );
              }
            }

            const subscriber = this.subscribersById[msg.cid];
            if (subscriber) {
              if (msg.d && msg.d.connected === true) {
                subscriber.onConnect && subscriber.onConnect(msg.d);
              } else {
                subscriber.onReceive(msg.d);
              }
            } else {
              this.__sendToWs(
                Commands.LeaveChannel({ channelName: msg.c, channelID: msg.cid }),
                true
              );
            }
          };

          if (data.data instanceof Blob) {
            const fr = new FileReader();
            fr.onload = event => {
              let msg;
              try {
                const arr = event.target.result;
                const unpacked = pako.inflate(arr, { to: 'string' });
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
    const channelNameUpperCase = channelName.toUpperCase();
    if (!this.subscribers[channelNameUpperCase]) {
      const channel = new WsChannel(this, channelName, onReceive, onConnect);
      this.subscribers[channelNameUpperCase] = channel;
      this.connected && this.__sendToWs(Commands.ConnectChannel({
        channelName: channel.channelName,
        message: data,
      }));

      return channel;
    }
  }

  _leaveChannel(subscriber) {
    this.__sendToWs(
      Commands.LeaveChannel({
        channelName: subscriber.channelName,
        channelID: subscriber.channelID,
      })
    );
    delete this.subscribers[subscriber.channelName.toUpperCase()];
  }

  _reconnect() {
    onReadyState(this).then(ws => ws.close());
  }

  _send(subscriber, data, force = false) {
    this.__sendToWs(
      Commands.SendToChannel({
        channelName: subscriber.channelName,
        channelID: subscriber.channelID,
        message: data,
      }),
      force
    );
  }

  __sendToWs(data, force = false) {
    return onReadyState(this, force).then(ws => ws.send(data));
  }
};
