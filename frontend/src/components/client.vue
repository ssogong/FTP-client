<template>
  <div class="container">
    <el-card class="sideContainer"
      :body-style="{ display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', height: '95%'}">
      <div class="topBar">
        <div class="inputBox">
          <span>Host: </span>
          <el-input v-model="HOST" size="small"></el-input>
        </div>
        <div class="inputBox">
          <span>Port: </span>
          <el-input v-model="PORT" size="small"></el-input>
        </div>
      </div>
      <div class="topBar">
        <div class="inputBox">
          <span>User: </span>
          <el-input v-model="USER" size="small"></el-input>
        </div>
        <div class="inputBox">
          <span>Password: </span>
          <el-input v-model="PASSWORD" size="small" show-password></el-input>
        </div>
      </div>
      <div class="buttonBar">
        <div>
          <el-button type="primary" :disabled="ifConnect" @click="connect">Connect</el-button>
          <el-button type="info" :disabled="!ifConnect" @click="disconnect">Disconnect</el-button>
        </div>
      </div>
      <!-- 命令窗口 -->
      <div class="commandBox">
        <el-input type="textarea" :rows="20" :readonly="true" :clearable="true" resize="none" v-model="textarea">
        </el-input>
        <div class="commandInput">
          <el-input placeholder="请输入指令" v-model="commandLine" :clearable="true"></el-input>
          <el-button type="success" @click="sendCMD">send</el-button>
        </div>
      </div>
    </el-card>


    <el-card class="sideContainer" id="right"
      :body-style="{ display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', height: '95%'}">
      <el-input size="small" placeholder="请输入待上传文件路径" v-model="filePath">
        <el-button slot="append" icon="el-icon-upload2" @click="uploadFile"></el-button>
      </el-input>
      <!-- 服务器列表 -->
      <el-card shadow="never">
        <el-input id="currentPath" placeholder="当前路径" v-model="currentPath" size="mini" :readonly="true"></el-input>
        <el-table :data="fileList" style="width: 100%" max-height="300" :row-style="{height: '0'}"
          :cell-style="{padding: '0'}">
          <el-table-column label="文件名" prop="name">
          </el-table-column>
          <el-table-column label="文件大小" prop="size">
          </el-table-column>
          <el-table-column label="文件类型" prop="type">
          </el-table-column>
          <el-table-column label="最近修改" prop="lastTime">
          </el-table-column>
        </el-table>
      </el-card>
      <!-- 传输列表 -->
      <el-card shadow="never">
        <el-table :data="fileStatus" style="width: 100%" max-height="300" :row-style="{height: '0'}"
          :cell-style="{padding: '0'}">
          <el-table-column label="文件名" prop="name">
          </el-table-column>
          <el-table-column label="路径" prop="path">
          </el-table-column>
          <el-table-column label="状态">
            <template slot-scope="scope">
              <el-progress :percentage="scope.row.percent < 100 ? scope.row.percent : 100"></el-progress>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </el-card>
  </div>
</template>

<script>
  import axios from 'axios'
  import io from 'socket.io-client'
  // import qs from 'qs'
  export default {
    name: 'client',
    props: {},
    data() {
      return {
        HOST: '',
        PORT: '21',
        USER: '',
        PASSWORD: '',
        textarea: '',
        commandLine: '',
        currentPath: '',
        filePath: '',
        fileList: [],
        fileStatus: [],
        msgSocket: null,
        ifConnect: false,
      }
    },
    created: function () {
      // 获取IP
      axios.get('/ip')
        .then((res) => {
          this.ip = res.data.split(" ")[4].slice(1, -2);
          console.log(this.ip);
          // this.ip = '172.30.1.2';
        })
      // 与后端消息通讯
      this.msgSocket = io.connect('http://localhost:3100');
      this.msgSocket.on('msg', (data) => {
        console.log(data);
        let strList = data.split(" ");
        // 更新路径
        if (strList[0] == 257) {
          this.currentPath = strList[1].replace(/"/g, '');
        }
        this.textarea += data;
      })
      // 收到列表
      this.msgSocket.on('list', (data) => {
        console.log(data);
        this.fileList = [];
        for (let raw of data) {
          raw = raw.split(" ");
          let len = raw.length;
          let tmp = {
            name: raw[len - 1],
            lastTime: raw[len - 4] + ' ' + raw[len - 3] + ' ' + raw[len - 2],
            size: raw[len - 5],
            type: raw[0][0] == 'd' ? '目录' : '文件'
          }
          this.fileList.push(tmp);
        }
        this.fileList.pop();
      })
      // 最近传输文件进度条
      this.msgSocket.on('percent', (data) => {
        console.log(data);
        let len = this.fileStatus.length;
        this.fileStatus[len - 1].percent = data;
      })
    },
    methods: {
      connect() {
        let data = {
          host: this.HOST,
          port: Number(this.PORT),
          user: this.USER,
          password: this.PASSWORD,
          ip: this.ip
        }
        axios.post('/api/login', data)
          .then((res) => {
            if (res.data.code == 200) {
              this.ifConnect = true;
              // this.$message({
              //   message: '登录成功!',
              //   type: 'success'
              // });
            }
          })
      },
      disconnect() {
        axios.get('/api/logout')
          .then(() => {
            this.ifConnect = false;
          });
      },
      sendCMD() {
        let cmd1 = this.commandLine.split(" ")[0];
        let cmd2 = this.commandLine.split(" ")[1];
        // RETR和STOR添加progrss
        if (cmd1 == 'RETR' || cmd1 == 'STOR') {
          let tmp = {
            name: cmd2,
            path: cmd1 == 'RETR' ? cmd2 : this.currentPath,
            percent: 0
          }
          this.fileStatus.push(tmp);
        }

        this.msgSocket.emit('msg', this.commandLine);
        this.commandLine = '';
      },
      getNowPath() {
        this.msgSocket.emit('msg', 'PWD');
      },
      uploadFile() {
        let tmp = {
          name: this.filePath.split('/').slice(-1)[0],
          path: this.filePath,
          percent: 0
        }
        this.fileStatus.push(tmp);
        this.msgSocket.emit('msg', 'STOR ' + this.filePath);
      }
    }
  }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
  .container {
    display: flex;
    width: 90%;
  }

  .sideContainer {
    position: relative;
    margin: 20px;
    width: 100%;
  }


  .topBar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 10px;
    text-align: left;
  }

  .topBar .el-input {
    width: 120px;
    padding: 0 10px;
  }

  .buttonBar {
    display: flex;
    justify-content: space-evenly;
    align-items: center;
    padding: 10px 0;
  }

  .commandInput {
    display: flex;
    padding: 10px 0;
  }

  .commandInput .el-input {
    margin: 0 20px;
  }

  #currentPath {
    height: 500px;
  }
</style>