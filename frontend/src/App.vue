<template>
  <div id="app">
    <client/>
  </div>
</template>

<script>
import client from './components/client.vue'

export default {
  name: 'App',
  components: {
    client
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #2c3e50;
}
html, body {
  width: 100%;
  height: 100%;
}
</style>
