# icom-ci-v

Icom CI-V control library in JS (tested against IC-705).

## Install

```bash
yarn add icom-ci-v
```

## Usage

`icom-ci-v` takes any serialport-like object (`write()`, `on("data")`, `opening`):

```javascript
const SerialPort = require("serialport").SerialPort;
const CIV = require("icom-ci-v");

const radio = CIV(new SerialPort({ path: "/dev/ttyACM0", baudRate: 115200 }));

radio.getFrequency().then((hz) => {
	console.log(hz);
});
```

Commands: `getFrequency`, `setFrequency(hz)`, `transmit`, `endTransmit`, `getSWR`,
`getSql`, `getToneSql`, `getWaveformData`, `setWaveformDataOut(enable)`, raw
`civ.run("<hex>")`, and `on("waveform", fn)` for scope data.

The radio address defaults to `A4` (IC-705); set `radio.civ.radioAddress` for others.
