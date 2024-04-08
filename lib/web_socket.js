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
      C: 'cc',
      N: channelName,
    };
    if (message) {
      obj.M = message;
    }
    return JSON.stringify(obj);
  },
  SendToChannel: ({ channelName, channelID, message }) => {
    const obj = {
      C: 'sc',
      CID: channelID,
    };
    if (message) {
      obj.M = message;
    }
    return JSON.stringify(obj);
  },
  LeaveChannel: ({ channelName, channelID }) => {
    return JSON.stringify({
      C: 'lc',
      N: channelName,
      CID: channelID,
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
      reconnectTimeout: 3000,
      ...props
    };
    this.api = new WsApi({
      ws: this,
      onConnect: () => launcher(this.props.tokenGetter).then(token => {
        this.api.post("USER_CONNECTION", { TOKEN: token }, { force: true })
          .then(data => {
            this.connected = true;
            Object.keys(this.subscribers).forEach(key => {
              if (key === this.api.channel.channelName) {
                return;
              }

              const subscriber = this.subscribers[key];
              delete this.subscribersById[subscriber.channelID];
              subscriber.channelID = undefined;

              this.__sendToWs(
                Commands.ConnectChannel({
                  channelName: subscriber.channelName,
                })
              );
            });
            this.props.onOpenFn && this.props.onOpenFn(data);
          });
      })
    });
    this.subscribers = { [this.api.channel.channelName]: this.api.channel };
    this.subscribersById = { [this.api.channel.channelID]: this.api.channel };
    this._connectWS();
  }

  __processMsg(msg) {
    let subscriber;
    if (msg.c) {
      subscriber = this.subscribers[msg.c.toUpperCase()];
      if (subscriber) {
        this.subscribersById[msg.cid] = subscriber;
        subscriber.channelID = msg.cid;

        if (msg.d && msg.d.connected === true) {
          return subscriber.onConnect && subscriber.onConnect(msg.d);
        }
      }
    } else {
      subscriber = this.subscribersById[msg.cid];
    }

    if (subscriber) {
      return msg.a ? subscriber.acts(msg) : subscriber.onReceive(msg.d);
    }

    return this.__sendToWs(
      Commands.LeaveChannel({ channelName: msg.c, channelID: msg.cid }),
      true
    );
  }

  _connectWS() {
    this.connected = false;
    launcher(this.props.targetGetter).then(target => {
      const protocol = location.protocol == "https:" ? "wss:" : "ws:";

      this.props.target = target;
      this.webSocket = new WebSocket(protocol + target);
      this.webSocket.addEventListener('close', () => setTimeout(() => this._connectWS(), this.props.reconnectTimeout));

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

      this.webSocket.addEventListener('message', wsMessage => {
        try {
          if (wsMessage.data instanceof Blob) {
            const fr = new FileReader();
            fr.onload = event => {
              let msg;
              try {
                const arr = event.target.result;
                const unpacked = pako.inflate(arr, { to: 'string' });
                msg = JSON.parse(unpacked);
              } catch (ex) {
                msg = JSON.parse(wsMessage.data);
              }
              this.__processMsg(msg);
            };
            fr.readAsArrayBuffer(wsMessage.data);
          } else {
            this.__processMsg(JSON.parse(wsMessage.data));
          }
        } catch(ex) {
          console.log(ex);
        }
      });
    });
  }

  connectChannel({channelName, onReceive, onConnect, acts}) {
    const channelNameUpperCase = channelName.toUpperCase();
    let channel = this.subscribers[channelNameUpperCase];
    if (!channel) {
      channel = new WsChannel({
        ws: this,
        channelName: channelNameUpperCase,
        onReceive,
        onConnect,
        acts
      });
      this.subscribers[channelNameUpperCase] = channel;
      this.connected && this.__sendToWs(Commands.ConnectChannel({
        channelName: channel.channelName,
      }));
    }

    return channel;
  }

  _leaveChannel(subscriber, sendToServer) {
    if (sendToServer) {
      this.__sendToWs(
        Commands.LeaveChannel({
          channelName: subscriber.channelName,
          channelID: subscriber.channelID,
        })
      );
    }

    delete this.subscribers[subscriber.channelName];
    if (subscriber.channelID) {
      delete this.subscribersById[subscriber.channelID];
    }
  }

  _reconnect() {
    onReadyState(this).then(ws => ws.close());
  }

  _send(subscriber, data, force = false) {
    return this.__sendToWs(
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
