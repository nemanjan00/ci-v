const SerialPort = require("serialport").SerialPort;

const CIV = require("../src");

const serialport = new SerialPort({
	path: '/dev/ttyACM0',
	baudRate: 9600
});

const civ = CIV(serialport);

civ.getSWR().then(swr => {
	const value = swr.slice(1);

	console.log(value);
});

const sweep = () => {
	return civ.getFrequency().then(frequency => {
		civ.setFrequency(frequency + 1000).then(() => {
			civ.transmit().then(() => {
				setTimeout(() => {
					civ.getSWR().then(swr => {
						console.log(swr);
						civ.endTransmit().then(() => {
							sweep();
						});
					});
				}, 10);
			});
		});
	});
};

civ.endTransmit();
sweep();
