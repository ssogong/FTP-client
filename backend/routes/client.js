const express = require('express');
const bodyparser = require('body-parser');
const net = require('net');
const fs = require('fs');
const { send, cwd } = require('process');
const io = require('socket.io').listen(3100);
const router = express.Router();
router.use(bodyparser.urlencoded({extended: true}));

/**
 * global
 */
let client = new net.Socket();
client.setEncoding('binary');
let clientSocket = null;     // 与gui message通讯
let dataSocket = null;    // 数据socket
let dataBuf = null;       // 数据buffer
let portServer = null;    // PORT server
let code = null;
let user = '';
let password = '';
let ip = '';
let flag = 0;       //1 retr 2 stor 3 list
let pasvFlag = 0;   //-1 port 0 null 1 pasv
let filePath = '';
/**
 * api
 */
// 登录
router.post('/login', (req, res, next) => {
  console.log(req.body);

  client.connect(req.body.port, req.body.host);
  user = req.body.user;
  password = req.body.password;
  ip = req.body.ip;

  let data = {};
  data.code = '200';
  res.send(data);
})
// 退出
router.get('/logout', (req, res, next) => {
  sendStr('QUIT');
  let data = {};
  data.code = '200';
  res.send(data);
})

io.on('connection', (socket) => {
  console.log('connected to GUI');
  clientSocket = socket;
  client.on('data', (data) => {
    // console.log(data.toString('binary'))
    clientSocket.emit('msg', data.toString());
    data.toString('binary');
    code = data.substring(0, 3);
    console.log(code)
    // 处理登录
    if (code == '220') {
      sendStr('USER ' + user);
    } else if (code == '331') {
      sendStr('PASS ' + password);
    } else if (code == '230') {
      sendStr('PWD');
    }
    // PASV
    else if (code == '227') {
      // 解析ip ，port
      let patt = /(\d*),(\d*),(\d*),(\d*),(\d*),(\d*)/i;
      let n = data.search(patt);
      let tmpStr = data.slice(n,-4).split(',');
      let pasvHost = tmpStr[0] + '.' + tmpStr[1] + '.' + tmpStr[2] + '.' + tmpStr[3];
      let pasvPort = Number(tmpStr[4])*256 + Number(tmpStr[5]);
      handlePASV(pasvHost, pasvPort);
    }
    // CWD 执行之后执行一遍PWD
    else if (code == '250') {
      sendStr('PWD');
    }
    // LIST
    else if (code == '226' && flag == 3) {
      clientSocket.emit('list', dataBuf.split('\r\n'));
    }
    // RETR
    else if (code == '226' && flag == 1) {
      fs.writeFileSync(fileName, dataBuf, 'binary', (err) => {
        if (err) {
          console.log("Error: " + err);
        } else {
          console.log("write file OK");
        }
      })
    }
    // STOR
    else if (code == '150' && flag == 2) {
      let rs = fs.createReadStream(filePath);
      let fileSize = fs.statSync(filePath).size;
      let sendSize = 0;
      let percent = 0;
      let packSize = 8192;
      let fd = fs.openSync(filePath, 'r');
      let buf = new Buffer.alloc(packSize);
      while (sendSize < fileSize) {
        fs.readSync(fd, buf, 0, buf.length, sendSize);
        data = buf.toString();
        dataSocket.write(data);
        sendSize += packSize;
        percent = Math.floor((sendSize / fileSize * 100));
        console.log(percent)
        // 向gui发送进度
        clientSocket.emit('percent', percent);
      }
      dataSocket.destroy();
    }

  })
  client.on('error', (err) => {
    console.log('Error: ' + err);
  })
  client.on('close', () => {
    console.log('Connection closed');
    process.exit(0);
  })

  // 获取GUI command
  clientSocket.on('msg', (data) => {
    console.log('CMD: ' + data);
    sendStr(data);
  })
})

function handlePASV(pasvHost, pasvPort) {
  dataSocket = new net.Socket();
  dataSocket.connect(pasvPort, pasvHost);
  pasvFlag = 1;
  dataBuf = null;
  // 榨干
  dataSocket.on('data', (data) => {
    dataBuf += data;
  })
  dataSocket.on('error', (err) => {
    console.log('Error: ' + err);
  })
  dataSocket.on('close', () => {
    console.log('PASV closed');
    pasvFlag = 0;
    dataSocket = null;
  })
}
function handlePORT() {
  portServer = net.createServer((socket) => {
    dataSocket = socket;
    console.log('PORT server created');
    socket.on('connect', () => {
      console.log('PORT socket connect');
      pasvFlag = -1;
      dataBuf = null;
    })
    socket.on('data', (data) => {
      console.log('socket data: ' + data);
    })
    socket.on('error', (err) => {
      console.log('Error: ' + err);
    })
    socket.on('close', () => {
      console.log('socket close');
      pasvFlag = 0;
      dataSocket = null;
    })
  })
  portServer.on('error', (err) => {
    console.log('Error: ' + err);
  })
  portServer.on('close', () => {
    console.log('server close');
    portServer = null;
  })
  portServer.listen(0, 'localhost', () => {
    console.log('PORT server listening');
    // 解析ip port
    let addr = portServer.address();
    let port = addr.port;
    let p1 = Math.floor(port / 256);
    let p2 = port % 256;
    let tmp = 'PORT ' + ip.replace(/\./g, ',') + ',' + p1 + ',' +p2;
    sendStr(tmp);
  })
}

function sendStr(cmd) {
  cmd1 = cmd.split(" ")[0];
  cmd2 = cmd.split(" ")[1];
  if (cmd1 == 'RETR') {
    if (pasvFlag == 0) {
      clientSocket.emit('msg', 'PASV\r\n');
      client.write('PASV\r\n', 'binary')
    }
    flag = 1;
    fileName = cmd.split(" ")[1];
  } else if (cmd1 == 'STOR') {
    if (pasvFlag == 0) {
      clientSocket.emit('msg', 'PASV\r\n');
      client.write('PASV\r\n', 'binary')
    }
    flag = 2;
    filePath = cmd2;
    fileName = cmd2.split('/').slice(-1)[0]
    cmd = 'STOR ' + fileName;
  } else if (cmd1 == 'LIST') {
    if (pasvFlag == 0) {
      clientSocket.emit('msg', 'PASV\r\n');
      client.write('PASV\r\n', 'binary')
    }
    flag = 3;
  } else if (cmd1 == 'PORT' && portServer == null) {
    handlePORT();
    return;
  }
  clientSocket.emit('msg', cmd+'\r\n');
  client.write(cmd + '\r\n', 'binary');
}

module.exports = router;