const net = require("net");

const host = "127.0.0.1";
const port = 22222;

let heartbeatInterval;

const client = net.createConnection(port, host, () => {
    console.log("Connected to " + host + ":" + port + ", sending verify packet.");
    writePacket(0, {"version": 1, "magic": 0x4a61786b});
    heartbeatInterval = setInterval(() => {
        writePacket(1, {"uid": 0, "heartbeat": Math.floor(Date.now()/1000)});
    }, 1000);
});

function readPackets(data){
    let packets = [];
    const packetLength = data.readUInt32BE(0);
    let packetData = data.subarray(4, packetLength + 4);

    let id = packetData.readUInt16BE(0);
    let uid = packetData.readUInt32BE(2);
    packetData = packetData.subarray(6);
    let packet = {"id": id, "uid": uid};

    //manual packet deserialization for now.
    if(id === 0){
        //Connect packet
        packet.version = packetData.readUInt8(0);
        packet.magic = packetData.readUInt32BE(1);
    }else if(id === 1){
        //Heartbeat packet
        packet.heartbeat = packetData.readUInt32BE(0);
    }else if(id === 63){
        //Disconnect packet
        let messageLength = packetData.readUInt32BE(0);
        packet.message = packetData.subarray(4, messageLength + 4).toString();
    }else{
        console.error(`Unknown packet id ${id} to read.`);
    }

    packets.push(packet);
    data = data.subarray(packetLength + 4);
    if(data.length > 0){
        readPackets(data).forEach((packet) => {
            packets.push(packet);
        });
    }
    return packets;
}

function writePacket(id, packet) {
    //manual packet serialization for now.
    let buf;
    if(id === 0){
        buf = Buffer.alloc(4 + 2 + 4 + 1 + 4);
        buf.writeUInt32BE(2 + 4 + 1 + 4); //packet length
        buf.writeUInt16BE(id, 4); //packet id
        buf.writeUInt32BE(0, 4 + 2); //uid
        buf.writeUInt8(packet.version, 4 + 2 + 4); //version
        buf.writeUInt32BE(packet.magic, 4 + 2 + 4 + 1); //magic
        //Connect packet
    }else if(id === 1){
        //Heartbeat packet
        buf = Buffer.alloc(4 + 2 + 4 + 4);
        buf.writeUInt32BE(2 + 4 + 4); //packet length
        buf.writeUInt16BE(id, 4); //packet id
        buf.writeUInt32BE(packet.uid, 4 + 2); //uid
        buf.writeUInt32BE(packet.heartbeat, 4 + 2 + 4); //heartbeat

    }else if(id === 63){
        //Disconnect packet
        buf = Buffer.alloc(4 + 2 + 4 + 4 + packet.message.length);
        buf.writeUInt32BE(2 + 4 + 4 + packet.message.length); //packet length
        buf.writeUInt16BE(id, 4); //packet id
        buf.writeUInt32BE(packet.uid, 4 + 2); //uid
        buf.writeUInt32BE(packet.message.length, 4 + 2 + 4); //message length
        buf.write(packet.message, 4 + 2 + 4 + 4); //message
    }else{
        console.error(`Unknown packet id ${id} to write.`);
        return;
    }
    client.write(buf);
}

client.on("data", (data) => {
    const packets = readPackets(data);
    packets.forEach((packet) => {
        console.log(`Received packet: ${JSON.stringify(packet)}`);
    });
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
    writePacket(63, {"message": "Critical error."});
    client.end(async() => {
        console.info("Connection closed.");
        process.kill(process.pid);
    });
});