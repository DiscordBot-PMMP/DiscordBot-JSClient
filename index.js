const net = require("net");

const host = "127.0.0.1";
const port = 22222;

const client = net.createConnection(port, host, () => {
    console.log("Connected");
    client.write(JSON.stringify({"status": 0, "packet": [0, {"version": 1, "magic": 0x4a61786b446576}]}))
});

client.on("data", (data) => {
    console.log(`Received: ${JSON.stringify(JSON.parse(data.toString()))}`);
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
    client.write(JSON.stringify([63, {"message": "Critical error."}]));
    client.end(async() => {
        console.info("Connection closed.");
        process.kill(process.pid);
    });
});