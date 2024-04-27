const CIV = require("./civ");

module.exports = (serialport) => {
	const civ = CIV(serialport);

	const commands = {
		civ,

		transmit: () => {
			return civ.run("1C0001");
		},

		endTransmit: () => {
			return civ.run("1C0000");
		},

		getFrequency: () => {
			return civ.run("03").then(frequency => {
				console.log(frequency);

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

	return commands;
};
