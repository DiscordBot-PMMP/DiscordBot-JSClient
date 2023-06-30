const net = require("net");

const host = "127.0.0.1";
const port = 22222;

function getBuffer(data) {
    data = JSON.stringify(data);
    let buf = Buffer.alloc(4 + Buffer.byteLength(data, "utf8"));
    buf.writeUInt32BE(Buffer.byteLength(data, "utf8"));
    buf.write(data, 4)
    return buf;
}

const client = net.createConnection(port, host, () => {
    console.log("Connected, sending verify packet.");
    client.write(getBuffer([0, {"version": 1, "magic": 0x4a61786b446576}]))
});

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
    console.log("Connection closed");
});

process.on("exit", async() => {
    client.end(async() => {
        console.log("Connection ended");
        process.exit()
    });
});

process.on('SIGINT', function() {
    console.error('Emergency exit.');
    client.write(getBuffer([63, {"message": "Critical error."}]));
    client.end(async() => {
        console.info("Connection closed.");
        process.kill(process.pid);
    });
});