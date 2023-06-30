const net = require("net");

const host = "127.0.0.1";
const port = 22222;

let heartbeatInterval;

const client = net.createConnection(port, host, () => {
    console.log("Connected to " + host + ":" + port + ", sending verify packet.");
    writePacket([0, {"version": 1, "magic": 0x4a61786b446576}]);
    heartbeatInterval = setInterval(() => {
        writePacket([1, {"uid": 0, "heartbeat": Date.now()/1000}]);
    }, 1000);
});

function writePacket(rawdata) {
    data = JSON.stringify(rawdata[1]);
    let buf = Buffer.alloc(4 + 2 + Buffer.byteLength(data, "utf8"));
    buf.writeUInt32BE(Buffer.byteLength(data, "utf8") + 2);
    buf.writeUInt16BE(rawdata[0], 4);
    buf.write(data, 4 + 2)
    client.write(buf);
}

client.on("data", (data) => {
    const length = data.readUInt32BE(0);
    let cdata = data.subarray(4, length + 4);
    data = data.subarray(length + 4);
    if(data.length > 0){
        console.log("leftover data: " + data);
    }
    console.log(`Received: Len=${length} Data=${cdata.toString()}`);
});

client.on("error", (error) => {
    console.log(`Error: ${error}`);
});

client.on("close", () => {
    if(heartbeatInterval){
        clearInterval(heartbeatInterval);
    }
    console.log("Connection closed");
});

process.on("exit", () => {
    client.end(() => {
        console.log("Connection ended");
        process.exit()
    });
});

process.on('SIGINT', function() {
    console.error('Emergency exit.');
    writePacket([63, {"message": "Critical error."}]);
    client.end(async() => {
        console.info("Connection closed.");
        process.kill(process.pid);
    });
});