# JS client for accessing stocks.dnmsk.ru api data.

https://stocks.dnmsk.ru is platform for algo trading on MOEX stocks exchange. Translating live data with post-processing are one of side effects that you can use for own purpose.

1. Use your account for .dnmsk.ru services and create api app on stocks.dnmsk.ru.
2. #### Initialize api instance
```
import Ws from "ru.dnmsk.stocks.api";

var client = new Ws({
  targetGetter: Promise,
  tokenGetter: Promise,
  onOpenFn: data => {...}
});
```
Props desribed in order that they calling.
    a. `targetGetter` must to return Api endpoint address.
    b. `tokenGetter` returns jwt token created with ClientID and ClientSecret.
    c. `onOpenFn` will be called after success authentication process.
All steps will be repeated on disconnect. Channels resubs automatically.

3. #### Generate jwt token.
```
payload = {
  client_id: ClientID,
  exp: (now + 2.minute).to_i,
  nbf: (now - 1.minute).to_i,
  iat: now.to_i
}
jwt_token = JWT.encode(payload, ClientSecret, 'HS512')
```

4. #### Make queries to api.
    a.
    ##### Subscribing to live data
    `channel = client.connectChannel(CHANNEL_NAME, DATA, onReceive)`

    b.
    ##### Unsubscribing channel
    `channel.disconnect()`

    c.
    ##### Quering without subscribe
    `client.api.get(CHANNEL_NAME, DATA).then(onReceive)`


### Channels and data.
#### Channels
Basically query looks like `{DATA_SOURCE}/{CLASS}/{SECURITY?}/{OPTION?}?{QUERY1&QUERYN}`
`onReceive` will be called each time on new data available.
There are three types channel, defference is in returning array of data:
1. Stocks.
`data_summary/{CLASS}` - returns data for currency, stocks, futures and options

2. Bonds
`data_bonds/{CLASS}` - returns data for bonds

3. Orderbook
`data_orderbook/{CLASS}/{SECTION}` - return orderbook.


`{CLASS}` - check class codes on MOEX or in your trade terminal
`{SECURITY}` - check security code on MOEX or in your trade terminal
`{OPTION}` - available only `with_nested` property. Will add all linked with CLASS/SECURIY instruments, like Stocks, Currencies, Futures and Options.

##### Query
Available is only for Stocks and bonds.
`fields=a,b,c` - send only selected fields in result
`target=all` - add summary report for selected query
`interval=mode` - set up grouping interval. Available modes: [D, H1, M30, M5, M1, S1, TICK]
`skip=a,b,c` - remove selected securities from result
`limit=N` - limit number of rows for each security.

#### Data
Additional properties for query to channel.

`date_from`, `date_to` dates in YYYYMMDD format. By default equals today.

### .API
Api has the same query interface with Channels. Available additional queries.

`PING` - returns current delays in system. Time between start query and receiving data is ping to stocks.dnmsk.
