const SerialPort = require("serialport").SerialPort;

const CIV = require("../src");

const serialport = new SerialPort({
	path: '/dev/ttyACM0',
	baudRate: 9600
});

const civ = CIV(serialport);

const Mhz = 1000 * 1000;

const channels = [
	446.00625 * Mhz,
	446.01875 * Mhz,
	446.03125 * Mhz,
	446.04375 * Mhz,
	446.05625 * Mhz,
	446.06875 * Mhz,
	446.08125 * Mhz,
	446.09375 * Mhz,
	446.10625 * Mhz,
	446.11875 * Mhz,
	446.13125 * Mhz,
	446.14375 * Mhz,
	446.15625 * Mhz,
	446.16875 * Mhz,
	446.18125 * Mhz,
	446.19375 * Mhz
];

let counter = 0;

const loop = () => {
	const freq = channels[counter];
	counter = (counter + 1) % channels.length;

	return civ.setFrequency(freq).then(() => {
		setTimeout(() => {
			return civ.getSql().then(sql => {
				if(sql) {
					console.log(`Stopping on ${freq / Mhz}`);

					return setTimeout(() => {
						loop();
					}, 5000);
				}

				loop();
			});
		}, 300);
	});
};

loop();
