const events = require("events");

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
				response[3] != civ.radioAddress[0] ||
				civ._task === undefined
			) {
				return civ._detectMessages();
			}

			const responseCommand = response.slice(4, 4 + civ._task.command.length);

			if(responseCommand.equals(Buffer.from("2700", "hex"))) {
				civ._events.emit("waveform", response);
			}

			if(responseCommand.equals(civ._task.command) === false && responseCommand[0] != 0xFB) {
				return civ._detectMessages();
			}

			const status = response[4];

			const callResult = response.slice(5, response.length - 1);

			if(status == 0xFB || (civ._task && status == civ._task.command[0])) {
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
		}
	};

	civ._init();

	return civ;
};
