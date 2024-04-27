const SerialPort = require("serialport").SerialPort;

const CIV = require("../src");

const serialport = new SerialPort({
	path: '/dev/ttyACM0',
	baudRate: 9600
});

const civ = CIV(serialport);

civ.on("waveform", console.log);

civ.setWaveformDataOut(false).then(() => {
	console.log(123);
});
