const events = require("events");
const SerialPort = require("serialport").SerialPort;

const serialport = new SerialPort({
	path: '/dev/ttyACM0',
	baudRate: 9600
});

module.exports = (serialport) => {
	// TX START 1C 00 01
	// TX STOP 1C 00 00
	// RX CHECK 14 03

	const civ = {
		preamble: Buffer.from("FEFE", "hex"),
		computerAddress: Buffer.from("E0", "hex"),
		radioAddress: Buffer.from("A4", "hex"),
		terminator: Buffer.from("FD", "hex"),

		inBuffer: Buffer.from("", "hex"),

		_rx: false,

		_events: new events(),

		_preparePromise: undefined,

		_task: undefined,

		_handlingQueue: false,

		_queue: [],

		_init: () => {
			return civ._preparePromise = new Promise((resolve) => {
				serialport.on("data", civ._dataHandler);

				if(serialport.opening === false) {
					return resolve();
				}

				serialport.on("open", () => {
					return resolve();
				});
			}).then(() => {
				setInterval(civ._waitForRx, 100);
			});
		},

		_waitForRx: () => {
			Promise.all([
				civ.run("1501"),
				civ.run("1505")
			]).then(result => {
				const rx = result[0][1] == 1 && result[1][1] == 1;

				if(rx && civ._rx === false) {
					civ._events.emit("rx");
				}

				if(!rx && civ._rx === true) {
					civ._events.emit("rx_end");
				}

				civ._rx = rx;
			});
		},

		_detectMessages: () => {
			const index = civ.inBuffer.indexOf(0xFD);

			if(index === -1) {
				return;
			}

			const response = civ.inBuffer.slice(0, index + 1)

			civ.inBuffer = civ.inBuffer.slice(index + 1);

			if(
				response[0] != 0xFE ||
				response[1] != 0xFE ||
				response[2] != civ.computerAddress[0] ||
				response[3] != civ.radioAddress[0]
			) {
				return civ._detectMessages();
			}

			const status = response[4];

			const callResult = response.slice(5, response.length - 1);

			if(status == 0xFB || status == civ._task.command[0]) {
				civ._task.resolve(callResult);
			} else {
				civ._task.reject(callResult);
			}

			civ._handlingQueue = false;
			civ._handleQueue();

			civ._detectMessages();
		},

		_dataHandler: (data) => {
			civ.inBuffer = Buffer.concat([civ.inBuffer, data]);

			civ._detectMessages();
		},

		_handleQueue: () => {
			if(civ._handlingQueue) {
				return;
			}

			civ._handlingQueue = true;

			if(civ._queue.length === 0) {
				civ._handlingQueue = false;

				return;
			}

			const task = civ._queue.shift();

			civ._task = task;

			return task.callback();
		},

		run: (command) => {
			return new Promise((resolve, reject) => {
				if(civ._preparePromise === undefined) {
					civ._init();
				}

				civ._preparePromise.then(() => {
					civ._queue.push({
						callback: () => {
							return serialport.write(Buffer.concat([
								civ.preamble,
								civ.radioAddress,
								civ.computerAddress,
								Buffer.from(command, "hex"),
								civ.terminator
							]));
						},
						reject,
						resolve,
						command: Buffer.from(command, "hex")
					});

					civ._handleQueue();
				}).catch(reject);
			});
		},

		on: (...args) => {
			return civ._events.on(...args);
		},

		transmit: () => {
			return civ.run("1C0001");
		},

		endTransmit: () => {
			return civ.run("1C0000");
		},

		getFrequency: () => {
			return civ.run("03").then(frequency => {
				const params = [];

				const values = [
					10,
					1,
					10e2,
					100,
					10e4,
					10e3,
					10e6,
					10e5,
					10e8,
					10e7
				];

				frequency.forEach(param => {
					params.push((param & 0xf0) >> 4);
					params.push(param & 0x0f);
				});

				const result = params.reduce((prev, val, key) => prev + val * values[key], 0);

				return result;
			});
		},

		setFrequency: (frequency) => {
			const decimalFreq = (frequency + "").padStart(10, "0").split("").reverse().join("");

			const segments = Array(decimalFreq.length / 2)
				.fill(0)
				.map((_, key) => {
					return ((decimalFreq[key * 2 + 1] << 4) | decimalFreq[key * 2]).toString(16).padStart(2, "0");
				});

			const freq = Buffer.from(segments.join(""), "hex");

			return civ.run(`05${freq.toString("hex")}`);
		},

		getSWR: () => {
			return civ.run("1512");
		}
	};

	civ._init();

	return civ;
};

const civ = module.exports(serialport);

civ.getSWR().then(swr => {
	const value = swr.slice(1);
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
//sweep();
