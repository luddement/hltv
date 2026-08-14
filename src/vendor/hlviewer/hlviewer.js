//#region node_modules/.pnpm/nanoevents@9.1.0/node_modules/nanoevents/index.js
var e = () => ({
	emit(e, ...t) {
		for (let n = this.events[e] || [], r = 0, i = n.length; r < i; r++) n[r](...t);
	},
	events: {},
	on(e, t) {
		return (this.events[e] ||= []).push(t), () => {
			this.events[e] = this.events[e]?.filter((e) => t !== e);
		};
	}
}), t = performance.now.bind(performance), n = (e) => {
	let t = Math.floor(e / 60), n = Math.floor(e - t * 60);
	return `${t < 10 ? `0${t}` : t.toString()}:${n < 10 ? `0${n}` : n.toString()}`;
}, r = typeof AudioContext === "undefined" ? null : new AudioContext(), i = class {
	context;
	channels;
	masterGain;
	preMuteVolume;
	events;
	constructor() {
		this.context = r, this.events = e();
		let t = Number.parseFloat(localStorage.getItem("volume") || "0.3");
		localStorage.setItem("volume", t.toString()), this.channels = [], this.preMuteVolume = 1, this.masterGain = this.context.createGain(), this.masterGain.gain.value = t, this.masterGain.connect(this.context.destination);
		for (let e = 0; e < 8; ++e) this.channels.push({
			source: null,
			gain: this.context.createGain()
		}), this.channels[e].gain.connect(this.masterGain);
	}
	static getContext() {
		return r;
	}
	play(e, t, n) {
		this.stop(t);
		let r = this.channels[t].gain;
		r.gain.value = Math.max(0, Math.min(1, n));
		let i = this.context.createBufferSource();
		i.buffer = e.buffer, i.connect(r), i.start(0), this.channels[t].source = i;
	}
	stop(e) {
		let t = this.channels[e].source;
		t && t.stop(0);
	}
	getVolume() {
		return this.masterGain.gain.value;
	}
	setVolume(e) {
		let t = this.masterGain.gain.value;
		t > 0 && e === 0 && (this.preMuteVolume = t), this.masterGain.gain.value = e, localStorage.setItem("volume", e.toString()), this.events.emit("volumeChange", e);
	}
	toggleMute() {
		this.getVolume() === 0 ? this.setVolume(this.preMuteVolume) : this.setVolume(0);
	}
}, a = class e {
	index;
	name;
	buffer;
	constructor(e) {
		this.index = -1, this.name = "", this.buffer = e;
	}
	static create(t) {
		return new Promise((n, r) => {
			i.getContext().decodeAudioData(t, (t) => {
				n(new e(t));
			}, (e) => {
				r(e);
			});
		});
	}
};
//#endregion
//#region src/Util.ts
function o(e, t) {
	return e.slice(e.lastIndexOf("/") + 1).replace(t || "", "");
}
function s(e) {
	let t = e.lastIndexOf("/"), n = e.lastIndexOf(".");
	return t < n ? e.slice(n) : "";
}
//#endregion
//#region src/Reader.ts
var c = /* @__PURE__ */ function(e) {
	return e[e.UByte = 0] = "UByte", e[e.Byte = 1] = "Byte", e[e.UShort = 2] = "UShort", e[e.Short = 3] = "Short", e[e.UInt = 4] = "UInt", e[e.Int = 5] = "Int", e[e.Float = 6] = "Float", e[e.Double = 7] = "Double", e[e.NString = 8] = "NString", e[e.String = 9] = "String", e;
}({}), l = class {
	data;
	offset;
	constructor(e) {
		this.data = new DataView(e), this.offset = 0;
	}
	length() {
		return this.data.byteLength;
	}
	tell() {
		return this.offset;
	}
	seek(e) {
		this.offset = Math.max(0, e);
	}
	skip(e) {
		this.seek(this.tell() + e);
	}
	b() {
		let e = this.data.getInt8(this.offset);
		return this.skip(1), e;
	}
	ub() {
		let e = this.data.getUint8(this.offset);
		return this.skip(1), e;
	}
	s(e = !0) {
		let t = this.data.getInt16(this.offset, e);
		return this.skip(2), t;
	}
	us(e = !0) {
		let t = this.data.getUint16(this.offset, e);
		return this.skip(2), t;
	}
	i(e = !0) {
		let t = this.data.getInt32(this.tell(), e);
		return this.skip(4), t;
	}
	ui(e = !0) {
		let t = this.data.getUint32(this.tell(), e);
		return this.skip(4), t;
	}
	f(e = !0) {
		let t = this.data.getFloat32(this.tell(), e);
		return this.skip(4), t;
	}
	lf(e = !0) {
		let t = this.data.getFloat64(this.tell(), e);
		return this.skip(8), t;
	}
	str() {
		let e = this.ub(), t = "";
		for (; e !== 0;) t += String.fromCharCode(e), e = this.ub();
		return t;
	}
	nstr(e) {
		let t = e;
		if (t < 0) return "";
		let n = "";
		for (; t > 0;) {
			--t;
			let e = this.ub();
			if (e === 0) break;
			n += String.fromCharCode(e);
		}
		return t !== 0 && this.skip(t), n;
	}
	arr(e, t) {
		let n = e;
		t.bind(this);
		let r = [];
		for (; n-- > 0;) r.push(t());
		return r;
	}
	arrx(e, t, n = 0) {
		switch (t) {
			case 0: {
				let t = new Uint8Array(this.data.buffer, this.tell(), e);
				return this.skip(e), t;
			}
			case 1: {
				let t = new Int8Array(this.data.buffer, this.tell(), e);
				return this.skip(e), t;
			}
			case 2: {
				let t = new Uint16Array(this.data.buffer, this.tell(), e);
				return this.skip(e * 2), t;
			}
			case 3: {
				let t = new Int16Array(this.data.buffer, this.tell(), e);
				return this.skip(e * 2), t;
			}
			case 4: {
				let t = new Uint32Array(this.data.buffer, this.tell(), e);
				return this.skip(e * 4), t;
			}
			case 5: {
				let t = new Int32Array(this.data.buffer, this.tell(), e);
				return this.skip(e * 4), t;
			}
			case 6: {
				let t = new Float32Array(this.data.buffer, this.tell(), e);
				return this.skip(e * 4), t;
			}
			case 7: {
				let t = new Float64Array(this.data.buffer, this.tell(), e);
				return this.skip(e * 8), t;
			}
			case 8: {
				let t = e, r = [];
				for (; t-- > 0;) r.push(this.nstr(n));
				return r;
			}
			case 9: {
				let t = e, n = [];
				for (; t-- > 0;) n.push(this.str());
				return n;
			}
		}
	}
}, u = class e {
	name;
	width;
	height;
	data;
	constructor(e, t, n, r) {
		this.name = e, this.width = t, this.height = n, this.data = r;
	}
	static parse(t, n) {
		let r = new l(t), i = {
			idLength: r.ub(),
			colorMapType: r.ub(),
			imageType: r.ub(),
			colorMap: {
				firstEntryIndex: r.us(),
				length: r.us(),
				size: r.ub()
			},
			image: {
				xOrigin: r.us(),
				yOrigin: r.us(),
				width: r.us(),
				height: r.us(),
				depth: r.ub(),
				descriptor: r.ub()
			}
		};
		if (i.idLength && r.arrx(i.idLength, c.UByte), i.colorMapType) throw Error("Not implemented");
		let a = i.image.width, o = i.image.height, s = a * o, u = /* @__PURE__ */ new Uint8Array();
		if (i.imageType === 2) {
			let e = s * i.image.depth / 8;
			if (u = r.arrx(e, c.UByte), i.image.depth === 24) {
				let e = new Uint8Array(s * 4);
				for (let t = 0; t < o; ++t) for (let n = 0; n < a; ++n) {
					let r = (o - 1 - t) * a + n;
					e[r * 4] = u[(t * a + n) * 3 + 2], e[r * 4 + 1] = u[(t * a + n) * 3 + 1], e[r * 4 + 2] = u[(t * a + n) * 3], e[r * 4 + 3] = 255;
				}
				u = e;
			} else if (i.image.depth === 32) {
				let e = new Uint8Array(s * 4);
				for (let t = 0; t < o; ++t) for (let n = 0; n < a; ++n) {
					let r = (o - 1 - t) * a + n;
					e[r * 4] = u[(t * a + n) * 4 + 2], e[r * 4 + 1] = u[(t * a + n) * 4 + 1], e[r * 4 + 2] = u[(t * a + n) * 4], e[r * 4 + 3] = 255;
				}
				u = e;
			}
		} else if (i.imageType === 10 && (u = new Uint8Array(s * 4), i.image.depth === 24)) for (let e = 0; e < o; ++e) for (let t = 0; t < a;) {
			let n = r.ub();
			if (n & 128) {
				n = (n & 127) + 1;
				let i = r.ub(), s = r.ub(), c = r.ub();
				for (; t < a && n;) {
					let r = (o - 1 - e) * a + t;
					u[r * 4] = c, u[r * 4 + 1] = s, u[r * 4 + 2] = i, u[r * 4 + 3] = 255, ++t, --n;
				}
			} else for (n = (n & 127) + 1; t < a && n;) {
				let i = (o - 1 - e) * a + t;
				u[i * 4 + 2] = r.ub(), u[i * 4 + 1] = r.ub(), u[i * 4] = r.ub(), u[i * 4 + 3] = 255, ++t, --n;
			}
		}
		return new e(n, i.image.width, i.image.height, u);
	}
};
//#endregion
//#region src/Parsers/Util.ts
function d(e, t) {
	let n = new Uint8Array(e.length * 4), r = e.length;
	for (let i = 0; i < r; ++i) n[i * 4] = t[e[i] * 3], n[i * 4 + 1] = t[e[i] * 3 + 1], n[i * 4 + 2] = t[e[i] * 3 + 2], n[i * 4 + 3] = 255;
	return n;
}
function f(e, t) {
	let n = new Uint8Array(e.length * 4), r = e.length;
	for (let i = 0; i < r; ++i) e[i] === 255 ? n[i * 4 + 3] = 0 : (n[i * 4] = t[e[i] * 3], n[i * 4 + 1] = t[e[i] * 3 + 1], n[i * 4 + 2] = t[e[i] * 3 + 2], n[i * 4 + 3] = 255);
	return n;
}
//#endregion
//#region src/Parsers/Wad.ts
function p(e) {
	let t = e.nstr(16), n = e.ui(), r = e.ui();
	e.skip(16);
	let i = n * r, a = e.arrx(i, c.UByte);
	e.skip(i / 64 * 21), e.skip(2);
	let o = e.arrx(768, c.UByte);
	return {
		type: "decal",
		name: t,
		width: n,
		height: r,
		data: t[0] === "{" ? f(a, o) : d(a, o)
	};
}
var m = (e, t) => ({
	type: "cache",
	name: t.name
});
function h(e) {
	let t = e.nstr(16), n = e.ui(), r = e.ui();
	e.skip(16);
	let i = n * r, a = e.arrx(i, c.UByte);
	e.skip(i / 64 * 21), e.skip(2);
	let o = e.arrx(768, c.UByte);
	return {
		type: "texture",
		name: t,
		width: n,
		height: r,
		data: t[0] === "{" ? f(a, o) : d(a, o)
	};
}
function g(e, t) {
	let n = e.ui() && 256, r = e.ui(), i = e.ui(), a = e.ui(), o = [];
	for (let t = 0; t < 256; ++t) {
		let t = e.us(), r = e.us();
		o.push({
			x: t % n,
			y: Math.floor(t / n) / a * a,
			width: r,
			height: a
		});
	}
	let s = n * r, l = e.arrx(s, c.UByte);
	e.skip(2);
	let u = e.arrx(768, c.UByte);
	return {
		type: "font",
		name: t.name,
		width: n,
		height: r,
		rowCount: i,
		rowHeight: a,
		glyphs: o,
		data: f(l, u)
	};
}
var _ = (e, t) => ({
	type: "unknown",
	name: t.name,
	data: e.arrx(t.length, c.UByte)
});
function v(e, t) {
	switch (e.seek(t.offset), t.type) {
		case 64: return p(e);
		case 66: return m(e, t);
		case 67: return h(e);
		case 70: return g(e, t);
		default: return _(e, t);
	}
}
var y = class e {
	entries;
	constructor(e) {
		this.entries = e;
	}
	static parse(t) {
		let n = new l(t);
		if (n.nstr(4) !== "WAD3") throw Error("Invalid WAD file format");
		let r = n.ui(), i = n.ui();
		n.seek(i);
		let a = [];
		for (let e = 0; e < r; ++e) {
			let e = {
				offset: n.ui(),
				diskLength: n.ui(),
				length: n.ui(),
				type: n.b(),
				isCompressed: n.b(),
				name: ""
			};
			n.skip(2), e.name = n.nstr(16), a.push(e);
		}
		let o = a.map((e) => v(n, e));
		return new e(o);
	}
}, b = class {
	name;
	chunks;
	resources;
	constructor(e) {
		this.name = o(e, ".bsp"), this.chunks = [], this.resources = {
			sounds: [],
			skins: [],
			models: [],
			decals: [],
			custom: [],
			events: []
		};
	}
	setResources(e) {
		for (let t of e) switch (t.type) {
			case 0:
				t.used = !1, this.resources.sounds.push(t);
				break;
			case 1:
				this.resources.skins.push(t);
				break;
			case 2:
				this.resources.models.push(t);
				break;
			case 3:
				this.resources.decals.push(t);
				break;
			case 4:
				this.resources.custom.push(t);
				break;
			case 5: this.resources.events.push(t);
		}
	}
	addChunk(e) {
		this.chunks.push(e);
	}
}, x = class {
	state;
	startTime;
	timeLength;
	data;
	reader;
	constructor(e, t) {
		this.state = e.clone(), this.startTime = t, this.timeLength = 10, this.data = null, this.reader = null;
	}
	setData(e) {
		this.data = new Uint8Array(e.length);
		for (let t = 0; t < e.length; ++t) this.data[t] = e[t];
		this.reader = new l(this.data.buffer);
	}
}, S = class e {
	cameraPos;
	cameraRot;
	entities;
	baselines;
	viewModel;
	viewEntity;
	weaponAnimation;
	constructor(e = null) {
		e ? (this.cameraPos = JSON.parse(JSON.stringify(e.cameraPos)), this.cameraRot = JSON.parse(JSON.stringify(e.cameraRot)), this.entities = JSON.parse(JSON.stringify(e.entities)), this.baselines = JSON.parse(JSON.stringify(e.baselines)), this.viewModel = e.viewModel, this.viewEntity = e.viewEntity, this.weaponAnimation = e.weaponAnimation == null ? null : JSON.parse(JSON.stringify(e.weaponAnimation))) : (this.cameraPos = [
			0,
			0,
			0
		], this.cameraRot = [
			0,
			0,
			0
		], this.entities = [], this.baselines = [], this.viewModel = 0, this.viewEntity = 0, this.weaponAnimation = null);
	}
	feedFrame(e) {
		switch (e.type) {
			case 0:
			case 1:
				this.cameraPos[0] = e.camera.position[0], this.cameraPos[1] = e.camera.position[1], this.cameraPos[2] = e.camera.position[2], this.cameraRot[0] = e.camera.orientation[0], this.cameraRot[1] = e.camera.orientation[1], this.cameraRot[2] = e.camera.orientation[2], this.viewModel = e.viewModel || this.viewModel, this.viewEntity = e.RefParams?.viewEntity || this.viewEntity;
				for (let message of e.data || []) {
					if (message.type === 22 && message.data?.entities) {
						this.baselines = JSON.parse(JSON.stringify(message.data.entities));
					} else if (message.type === 40 && message.data?.entityStates) {
						let nextEntities = [];
						for (let index = 0; index < message.data.entityStates.length; index++) {
							let n = message.data.entityStates[index];
							if (!n) continue;
							nextEntities[index] = { ...(this.baselines[index] || {}), ...n, __entityNumber: index };
						}
						this.entities = nextEntities;
					} else if (message.type === 41 && message.data?.entityStates) {
						for (let index = 0; index < message.data.entityStates.length; index++) {
							let n = message.data.entityStates[index];
							if (!n) continue;
							if (n.__remove) delete this.entities[index];
							else this.entities[index] = { ...(this.entities[index] || this.baselines[index] || {}), ...n, __entityNumber: index };
						}
					} else if (message.type === 35 && message.data) {
						this.weaponAnimation = message.data;
					}
				}
				break;
			case 7:
				this.weaponAnimation = e.weaponAnimation;
		}
	}
	clone() {
		return new e(this);
	}
};
//#endregion
//#region src/Replay/readCoord.ts
function C(e) {
	let t = e.readBits(1), n = e.readBits(1);
	if (!t && !n) return 0;
	let r = e.readBits(1), i = 0, a = 0;
	t && (i = e.readBits(12)), n && (a = e.readBits(3));
	let o = i + a / 32;
	return r && (o = -o), o;
}
//#endregion
//#region src/Replay/DeltaType.ts
var w = /* @__PURE__ */ function(e) {
	return e[e.DT_BYTE = 1] = "DT_BYTE", e[e.DT_SHORT = 2] = "DT_SHORT", e[e.DT_FLOAT = 4] = "DT_FLOAT", e[e.DT_INTEGER = 8] = "DT_INTEGER", e[e.DT_ANGLE = 16] = "DT_ANGLE", e[e.DT_TIMEWINDOW_8 = 32] = "DT_TIMEWINDOW_8", e[e.DT_TIMEWINDOW_BIG = 64] = "DT_TIMEWINDOW_BIG", e[e.DT_STRING = 128] = "DT_STRING", e[e.DT_SIGNED = -2147483648] = "DT_SIGNED", e;
}({});
//#endregion
//#region src/Replay/readDelta.ts
function T(e, t) {
	let n = {}, r = e.readBits(3), i = [];
	for (let t = 0; t < r; ++t) i.push(e.readBits(8));
	let a = !1;
	for (let o = 0; o < r; ++o) {
		for (let r = 0; r < 8; ++r) {
			let s = r + o * 8;
			if (s === t.length) {
				a = !0;
				break;
			}
			if (i[o] & 1 << r) {
				if (t[s].flags & w.DT_BYTE) {
					if (t[s].flags & w.DT_SIGNED) {
						let r = e.readBits(1) ? -1 : 1, i = e.readBits(t[s].bits - 1), a = t[s].divisor;
						n[t[s].name] = r * i / a;
					} else {
						let r = e.readBits(t[s].bits), i = t[s].divisor;
						n[t[s].name] = r / i;
					}
				} else if (t[s].flags & w.DT_SHORT) {
					if (t[s].flags & w.DT_SIGNED) {
						let r = e.readBits(1) ? -1 : 1, i = e.readBits(t[s].bits - 1), a = t[s].divisor;
						n[t[s].name] = r * i / a;
					} else {
						let r = e.readBits(t[s].bits), i = t[s].divisor;
						n[t[s].name] = r / i;
					}
				} else if (t[s].flags & w.DT_INTEGER) {
					if (t[s].flags & w.DT_SIGNED) {
						let r = e.readBits(1) ? -1 : 1, i = e.readBits(t[s].bits - 1), a = t[s].divisor;
						n[t[s].name] = r * i / a;
					} else {
						let r = e.readBits(t[s].bits), i = t[s].divisor;
						n[t[s].name] = r / i;
					}
				} else if (t[s].flags & w.DT_FLOAT || t[s].flags & w.DT_TIMEWINDOW_8 || t[s].flags & w.DT_TIMEWINDOW_BIG) {
					if (t[s].flags & w.DT_SIGNED) {
						let r = e.readBits(1) ? -1 : 1, i = e.readBits(t[s].bits - 1), a = t[s].divisor;
						n[t[s].name] = r * i / a;
					} else {
						let r = e.readBits(t[s].bits), i = t[s].divisor;
						n[t[s].name] = r / i;
					}
				} else if (t[s].flags & w.DT_ANGLE) {
					let r = e.readBits(t[s].bits), i = 360 / (1 << t[s].bits);
					n[t[s].name] = r * i;
				} else t[s].flags & w.DT_STRING && (n[t[s].name] = e.readString());
			}
		}
		if (a) break;
	}
	return n;
}
var ee = { delta_description_t: [
	{
		name: "flags",
		bits: 32,
		divisor: 1,
		flags: w.DT_INTEGER
	},
	{
		name: "name",
		bits: 8,
		divisor: 1,
		flags: w.DT_STRING
	},
	{
		name: "offset",
		bits: 16,
		divisor: 1,
		flags: w.DT_INTEGER
	},
	{
		name: "size",
		bits: 8,
		divisor: 1,
		flags: w.DT_INTEGER
	},
	{
		name: "bits",
		bits: 8,
		divisor: 1,
		flags: w.DT_INTEGER
	},
	{
		name: "divisor",
		bits: 32,
		divisor: 4e3,
		flags: w.DT_FLOAT
	},
	{
		name: "preMultiplier",
		bits: 32,
		divisor: 4e3,
		flags: w.DT_FLOAT
	}
] }, te = () => ({ ...ee }), ne = class e {
	static scratch = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(8));
	view;
	constructor(e) {
		this.view = new Uint8Array(e, 0, e.byteLength);
	}
	getBits(e, t, n = !1) {
		let r = e;
		if (t > this.view.length * 8 - r) throw Error("Bits out of bounds");
		let i = 0;
		for (let e = 0; e < t;) {
			let n = t - e, a = r & 7, o = this.view[r >> 3], s = Math.min(n, 8 - a), c = (1 << s) - 1, l = o >> a & c;
			i |= l << e, r += s, e += s;
		}
		return n ? (t !== 32 && i & 1 << t - 1 && (i |= -1 ^ (1 << t) - 1), i) : i >>> 0;
	}
	getInt8(e) {
		return this.getBits(e, 8, !0);
	}
	getUint8(e) {
		return this.getBits(e, 8, !1);
	}
	getInt16(e) {
		return this.getBits(e, 16, !0);
	}
	getUint16(e) {
		return this.getBits(e, 16, !1);
	}
	getInt32(e) {
		return this.getBits(e, 32, !0);
	}
	getUint32(e) {
		return this.getBits(e, 32, !1);
	}
	getFloat32(t) {
		return e.scratch.setUint32(0, this.getUint32(t)), e.scratch.getFloat32(0);
	}
	getFloat64(t) {
		return e.scratch.setUint32(0, this.getUint32(t)), e.scratch.setUint32(4, this.getUint32(t + 32)), e.scratch.getFloat64(0);
	}
}, E = class {
	view;
	index;
	constructor(e) {
		this.view = new ne(e), this.index = 0;
	}
	readBits(e, t = !1) {
		let n = this.view.getBits(this.index, e, t);
		return this.index += e, n;
	}
	readInt8() {
		let e = this.view.getInt8(this.index);
		return this.index += 8, e;
	}
	readUint8() {
		let e = this.view.getUint8(this.index);
		return this.index += 8, e;
	}
	readInt16() {
		let e = this.view.getInt16(this.index);
		return this.index += 16, e;
	}
	readUint16() {
		let e = this.view.getUint16(this.index);
		return this.index += 16, e;
	}
	readInt32() {
		let e = this.view.getInt32(this.index);
		return this.index += 32, e;
	}
	readUint32() {
		let e = this.view.getUint32(this.index);
		return this.index += 32, e;
	}
	readFloat32() {
		let e = this.view.getFloat32(this.index);
		return this.index += 32, e;
	}
	readFloat64() {
		let e = this.view.getFloat64(this.index);
		return this.index += 64, e;
	}
	readString(e = 0, t = !1) {
		let n = 0, r = [], i = !0;
		for (; !e || e && n < e;) {
			let t = this.readUint8();
			if (t === 0 && (i = !1, !e)) break;
			i && r.push(t), n++;
		}
		let a = String.fromCharCode.apply(null, r);
		if (t) try {
			return decodeURIComponent(a);
		} catch {
			return a;
		}
		return a;
	}
}, D = {
	bad() {
		throw Error("Invalid message type");
	},
	nop() {
		return null;
	},
	disconnect(e) {
		return { reason: e.str() };
	},
	event(e, t) {
		let n = new E(e.data.buffer);
		n.index = e.tell() * 8;
		let r = [], i = n.readBits(5);
		for (let e = 0; e < i; ++e) {
			let e = { index: n.readBits(10) };
			n.readBits(1) && (e.packetIndex = n.readBits(11), n.readBits(1) && (e.delta = T(n, t.event_t))), n.readBits(1) && (e.fireTime = n.readBits(16)), r.push(e);
		}
		return n.index % 8 > 0 ? e.seek(Math.floor(n.index / 8) + 1) : e.seek(n.index / 8), { events: r };
	},
	version(e) {
		return { version: e.ui() };
	},
	setView(e) {
		return { entityIndex: e.s() };
	},
	sound(e) {
		let t = new E(e.data.buffer);
		t.index = e.tell() * 8;
		let n = t.readBits(9), r = 1;
		n & 1 && (r = t.readBits(8) / 255);
		let i = 1;
		n & 2 && (i = t.readBits(8) / 64);
		let a = t.readBits(3), o = t.readBits(11), s;
		s = n & 4 ? t.readBits(16) : t.readBits(8);
		let c = t.readBits(1), l = t.readBits(1), u = t.readBits(1), d = 0, f = 0, p = 0;
		c && (d = C(t)), l && (f = C(t)), u && (p = C(t));
		let m = 1;
		return n & 8 && (m = t.readBits(8)), t.index % 8 > 0 ? e.seek(Math.floor(t.index / 8) + 1) : e.seek(t.index / 8), {
			flags: n,
			volume: r,
			attenuation: i,
			channel: a,
			entityIndex: o,
			soundIndex: s,
			xPosition: d,
			yPosition: f,
			zPosition: p,
			pitch: m
		};
	},
	time(e) {
		return { time: e.f() };
	},
	print(e) {
		return { message: e.str() };
	},
	stuffText(e) {
		return { commands: e.str().split(";").map((e) => {
			let t = e.split(/\s*("[^"]+"|[^\s"]+)/).map((e) => e.replace(/^"(.*)"$/, "$1").trim()).filter((e) => e);
			return {
				func: t[0],
				params: t.slice(1)
			};
		}) };
	},
	setAngle(e) {
		return {
			pitch: e.s(),
			yaw: e.s(),
			roll: e.s()
		};
	},
	serverInfo(e, t) {
		let n = {
			protocol: e.i(),
			spawnCount: e.i(),
			mapCrc: e.i(),
			clientDllHash: e.arrx(16, c.UByte),
			maxPlayers: e.ub(),
			playerIndex: e.ub(),
			isDeathmatch: e.ub(),
			gameDir: e.str(),
			hostName: e.str(),
			mapFileName: e.str(),
			mapCycle: e.str()
		};
		return e.ub() > 0 && e.skip(21), Object.defineProperty(t, "__maxPlayers", {
			configurable: !0,
			value: n.maxPlayers
		}), Object.defineProperty(t, "__protocol", {
			configurable: !0,
			value: n.protocol
		}), n;
	},
	lightStyle(e) {
		return {
			index: e.ub(),
			lightInfo: e.str()
		};
	},
	updateUserInfo(e) {
		return {
			clientIndex: e.ub(),
			clientUserId: e.ui(),
			clientUserInfo: e.str(),
			clientCdKeyHash: e.arrx(16, c.UByte)
		};
	},
	deltaDescription(e, t) {
		let n = {
			name: e.str(),
			fields: []
		}, r = new E(e.data.buffer), i = e.us();
		r.index = e.tell() * 8;
		for (let e = 0; e < i; ++e) n.fields.push(T(r, t.delta_description_t));
		return t[n.name] = n.fields, r.index % 8 > 0 ? e.seek(Math.floor(r.index / 8) + 1) : e.seek(r.index / 8), n;
	},
	clientData(e, t) {
		// HLTV proxy clients are spectators. GoldSrc emits svc_clientdata as a
		// marker for them but returns before writing the delta/weapon bitstream.
		if (t.__hltvActive) return { clientData: null };
		let n = new E(e.data.buffer);
		n.index = e.tell() * 8, n.readBits(1) && (n.index += 8);
		let r = t.clientdata_t, i = T(n, r), a = t.weapon_data_t;
		for (; n.readBits(1);) n.index += (t.__protocol || 48) < 47 ? 5 : 6, T(n, a);
		return n.index % 8 > 0 ? e.seek(Math.floor(n.index / 8) + 1) : e.seek(n.index / 8), { clientData: i };
	},
	stopSound(e) {
		return { entityIndex: e.s() };
	},
	pings(e) {
		let t = new E(e.data.buffer);
		t.index = e.tell() * 8;
		let n = [];
		for (; t.readBits(1);) n.push({
			slot: t.readBits(8),
			ping: t.readBits(8),
			loss: t.readBits(8)
		});
		return t.index % 8 > 0 ? e.seek(Math.floor(t.index / 8) + 1) : e.seek(t.index / 8), n;
	},
	particle(e) {
		return {
			position: [
				e.s() / 8,
				e.s() / 8,
				e.s() / 8
			],
			direction: [
				e.b(),
				e.b(),
				e.b()
			],
			count: e.ub(),
			color: e.ub()
		};
	},
	damage() {
		return null;
	},
	spawnStatic(e) {
		let t = {
			modelIndex: e.s(),
			sequence: e.b(),
			frame: e.b(),
			colorMap: e.s(),
			skin: e.b(),
			position: [],
			rotation: []
		};
		return t.position[0] = e.s() / 8, t.rotation[0] = e.b() * (360 / 256), t.position[1] = e.s() / 8, t.rotation[1] = e.b() * (360 / 256), t.position[2] = e.s() / 8, t.rotation[2] = e.b() * (360 / 256), t.renderMode = e.b(), t.renderMode && (t.renderAmt = e.b(), t.renderColor = [
			e.ub(),
			e.ub(),
			e.ub()
		], t.renderFx = e.b()), t;
	},
	eventReliable(e, t) {
		let n = new E(e.data.buffer);
		n.index = e.tell() * 8;
		let r = n.readBits(10), i = T(n, t.event_t), a = n.readBits(1), o = 0;
		return a && (o = n.readBits(16)), n.index % 8 > 0 ? e.seek(Math.floor(n.index / 8) + 1) : e.seek(n.index / 8), {
			eventIndex: r,
			eventData: i,
			delayBit: a,
			delay: o
		};
	},
	spawnBaseLine(e, t) {
		let n = new E(e.data.buffer);
		n.index = e.tell() * 8;
		let r = [];
		for (;;) {
			let e = n.readBits(11);
			if (e === 2047) break;
			let i = n.readBits(2), a;
			if (i & 1) {
				let n = t.__maxPlayers || 32;
				a = e > 0 && e <= n ? "entity_state_player_t" : "entity_state_t";
			} else a = "custom_entity_state_t";
			if (!t[a]) throw Error(`Missing delta decoder ${a} for entity ${e}; available: ${Object.keys(t).join(", ")}`);
			r[e] = T(n, t[a]);
		}
		if (n.readBits(5) !== 31) throw Error("Bad spawnbaseline");
		let i = n.readBits(6), a = [];
		for (let e = 0; e < i; ++e) a.push(T(n, t.entity_state_t));
		return n.index % 8 > 0 ? e.seek(Math.floor(n.index / 8) + 1) : e.seek(n.index / 8), {
			entities: r,
			extraData: a
		};
	},
	tempEntity(e) {
		let t = e.ub(), n = {};
		switch (t) {
			case 0:
				e.skip(24);
				break;
			case 1:
				e.skip(20);
				break;
			case 2:
				e.skip(6);
				break;
			case 3:
				e.skip(11);
				break;
			case 4:
				e.skip(6);
				break;
			case 5:
				e.skip(10);
				break;
			case 6:
				e.skip(12);
				break;
			case 7:
				e.skip(17);
				break;
			case 8:
				e.skip(16);
				break;
			case 9:
				e.skip(6);
				break;
			case 10:
				e.skip(6);
				break;
			case 11:
				e.skip(6);
				break;
			case 12:
				e.skip(8);
				break;
			case 13:
				e.skip(8), e.s() && e.skip(2);
				break;
			case 14:
				e.skip(9);
				break;
			case 15:
				e.skip(19);
				break;
			case 17:
				e.skip(10);
				break;
			case 18:
				e.skip(16);
				break;
			case 19:
				e.skip(24);
				break;
			case 20:
				e.skip(24);
				break;
			case 21:
				e.skip(24);
				break;
			case 22:
				e.skip(10);
				break;
			case 23:
				e.skip(11);
				break;
			case 24:
				e.skip(16);
				break;
			case 25:
				e.skip(19);
				break;
			// TE_BEAMHOSE is obsolete and has no standard payload in GoldSrc.
			case 26:
				break;
			case 27:
				e.skip(12);
				break;
			case 28:
				e.skip(16);
				break;
			case 29:
				n.channel = e.b(), n.x = e.s(), n.y = e.s(), n.effect = e.b(), n.textColor = [
					e.ub(),
					e.ub(),
					e.ub(),
					e.ub()
				], n.effectColor = [
					e.ub(),
					e.ub(),
					e.ub(),
					e.ub()
				], n.fadeInTime = e.s(), n.fadeOutTime = e.s(), n.holdTime = e.s(), n.effect && (n.effectTime = e.s()), n.message = e.str();
				break;
			case 30:
				e.skip(17);
				break;
			case 31:
				e.skip(17);
				break;
			case 99:
				e.skip(2);
				break;
			case 100:
				e.skip(10);
				break;
			case 101:
				e.skip(14);
				break;
			case 102:
				e.skip(12);
				break;
			case 103:
				e.skip(14);
				break;
			case 104:
				e.skip(9);
				break;
			case 105:
				e.skip(5);
				break;
			case 106:
				e.skip(17);
				break;
			case 107:
				e.skip(13);
				break;
			case 108:
				e.skip(24);
				break;
			case 109:
				e.skip(9);
				break;
			case 110:
				e.skip(17);
				break;
			case 111:
				e.skip(7);
				break;
			case 112:
				e.skip(10);
				break;
			case 113:
				e.skip(19);
				break;
			case 114:
				e.skip(19);
				break;
			case 115:
				e.skip(12);
				break;
			case 116:
				e.skip(7);
				break;
			case 117:
				e.skip(7);
				break;
			case 118:
				e.skip(9);
				break;
			case 119:
				e.skip(16);
				break;
			case 120:
				e.skip(18);
				break;
			case 121:
				e.skip(5);
				break;
			case 122:
				e.skip(10);
				break;
			case 123:
				e.skip(9);
				break;
			case 124:
				e.skip(7);
				break;
			case 125:
				e.skip(1);
				break;
			case 126:
				e.skip(18);
				break;
			case 127:
				e.skip(15);
				break;
			default: throw Error(`Unknown temp entity type ${t} at offset ${e.tell() - 1}`);
		}
		return n;
	},
	setPause(e) {
		return { isPaused: e.b() };
	},
	signOnNum(e) {
		return { sign: e.b() };
	},
	centerPrint(e) {
		return { message: e.str() };
	},
	killedMonster() {
		return null;
	},
	foundSecret() {
		return null;
	},
	spawnStaticSound(e) {
		return {
			position: [
				e.s() / 8,
				e.s() / 8,
				e.s() / 8
			],
			soundIndex: e.us(),
			volume: e.ub() / 255,
			attenuation: e.ub() / 64,
			entityIndex: e.us(),
			pitch: e.ub(),
			flags: e.ub()
		};
	},
	intermission() {
		return null;
	},
	finale(e) {
		return { text: e.str() };
	},
	cdTrack(e) {
		return {
			track: e.b(),
			loopTrack: e.b()
		};
	},
	restore(e) {
		let t = e.str(), n = e.ub(), r = [];
		for (let t = 0; t < n; ++t) r.push(e.str());
		return {
			saveName: t,
			maps: r
		};
	},
	cutscene(e) {
		return { text: e.str() };
	},
	weaponAnim(e) {
		return {
			sequenceNumber: e.b(),
			weaponModelBodyGroup: e.b()
		};
	},
	decalName(e) {
		return {
			positionIndex: e.ub(),
			decalName: e.str()
		};
	},
	roomType(e) {
		return { type: e.us() };
	},
	addAngle(e) {
		return { angleToAdd: e.s() / (360 / 65536) };
	},
	newUserMsg(e) {
		return {
			index: e.ub(),
			size: e.b(),
			name: e.nstr(16)
		};
	},
	packetEntities(e, t) {
		let n = new E(e.data.buffer);
		n.index = e.tell() * 8;
		let r = [];
		n.readBits(16);
		let i = 0;
		for (; n.readBits(16) !== 0;) {
			n.index -= 16, n.readBits(1) ? i++ : n.readBits(1) ? i = n.readBits(11) : i += n.readBits(6);
			let e = n.readBits(1), s = n.readBits(1), c = -1;
			s && (c = n.readBits(6));
			let a = "entity_state_t";
			i > 0 && i <= (t.__maxPlayers || 32) ? a = "entity_state_player_t" : e && (a = "custom_entity_state_t");
			let o = T(n, t[a]);
			o.__entityNumber = i, o.__baselineIndex = c, r[i] = o;
		}
		return n.index % 8 > 0 ? e.seek(Math.floor(n.index / 8) + 1) : e.seek(n.index / 8), { entityStates: r };
	},
	deltaPacketEntities(e, t) {
		let n = new E(e.data.buffer);
		n.index = e.tell() * 8, n.readBits(16), n.index += 8;
		let r = [], i = 0;
		for (; n.readBits(16) !== 0;) {
			n.index -= 16;
			let e = n.readBits(1);
			if (n.readBits(1) ? i = n.readBits(11) : i += n.readBits(6), e) {
				r[i] = { __remove: !0, __entityNumber: i };
				continue;
			}
			let a = n.readBits(1), o = "entity_state_t";
			i > 0 && i <= (t.__maxPlayers || 32) ? o = "entity_state_player_t" : a && (o = "custom_entity_state_t"), r[i] = T(n, t[o]), r[i].__entityNumber = i;
		}
		return n.index % 8 > 0 ? e.seek(Math.floor(n.index / 8) + 1) : e.seek(n.index / 8), { entityStates: r };
	},
	choke() {
		return null;
	},
	resourceList(e) {
		let t = new E(e.data.buffer);
		t.index = e.tell() * 8;
		let n = [], r = t.readBits(12);
		for (let e = 0; e < r; ++e) {
			let e = {
				type: t.readBits(4),
				name: t.readString(),
				index: t.readBits(12),
				size: t.readBits(24)
			};
			t.readBits(3) & 4 && (t.index += 128), t.readBits(1) && (t.index += 256), n.push(e);
		}
		if (t.readBits(1)) for (; t.readBits(1);) {
			let e = t.readBits(1) ? 5 : 10;
			t.index += e;
		}
		return t.index % 8 > 0 ? e.seek(Math.floor(t.index / 8) + 1) : e.seek(t.index / 8), n;
	},
	newMoveVars(e) {
		return {
			gravity: e.f(),
			stopSpeed: e.f(),
			maxSpeed: e.f(),
			spectatorMaxSpeed: e.f(),
			acceleration: e.f(),
			airAcceleration: e.f(),
			waterAcceleration: e.f(),
			friction: e.f(),
			edgeFriction: e.f(),
			waterFriction: e.f(),
			entityGravity: e.f(),
			bounce: e.f(),
			stepSize: e.f(),
			maxVelocity: e.f(),
			zMax: e.f(),
			waveHeight: e.f(),
			footsteps: e.b(),
			rollAngle: e.f(),
			rollSpeed: e.f(),
			skyColor: [
				e.f(),
				e.f(),
				e.f()
			],
			skyVec: [
				e.f(),
				e.f(),
				e.f()
			],
			skyName: e.str()
		};
	},
	resourceRequest(e) {
		let t = { spawnCount: e.i() };
		return e.skip(4), t;
	},
	customization(e) {
		let t = e.ub(), n = e.ub(), r = e.str(), i = e.us(), a = e.ui(), o = e.ub(), s = null;
		return o & 4 && (s = [
			e.i(),
			e.i(),
			e.i(),
			e.i()
		]), {
			playerIndex: t,
			type: n,
			name: r,
			index: i,
			downloadSize: a,
			flags: o,
			md5hash: s
		};
	},
	crosshairAngle(e) {
		return {
			pitch: e.b(),
			yaw: e.b()
		};
	},
	soundFade(e) {
		return {
			initialPercent: e.ub(),
			holdTime: e.ub(),
			fadeOutTime: e.ub(),
			fadeInTime: e.ub()
		};
	},
	fileTxferFailed(e) {
		return { filename: e.str() };
	},
	hltv(e, t) {
		let n = e.ub();
		if (n === 0) t.__hltvActive = !0;
		// GoldSrc HLTV_STATUS carries spectator/server counters after the mode:
		// long, short, word, long, long, word (18 bytes). Leaving this payload in
		// the stream makes every following byte look like a service/user message.
		if (n === 1) e.skip(18);
		else if (n === 2) {
			(t.__protocol || 48) === 46 ? e.skip(8) : e.str();
		}
		return { mode: n };
	},
	director(e) {
		let t = e.ub();
		return {
			flag: e.ub(),
			message: e.nstr(t - 1)
		};
	},
	voiceInit(e, t) {
		return {
			codecName: e.str(),
			quality: (t.__protocol || 48) >= 47 ? e.b() : void 0
		};
	},
	voiceData(e) {
		let t = e.ub(), n = e.us();
		return {
			playerIndex: t,
			data: e.arrx(n, c.UByte)
		};
	},
	sendExtraInfo(e) {
		return {
			fallbackDir: e.str(),
			canCheat: e.ub()
		};
	},
	timeScale(e) {
		return { timeScale: e.f() };
	},
	resourceLocation(e) {
		return { url: e.str() };
	},
	sendCvarValue(e) {
		return { name: e.str() };
	},
	sendCvarValue2(e) {
		return {
			requestId: e.ui(),
			name: e.str()
		};
	}
}, re = [
	D.bad,
	D.nop,
	D.disconnect,
	D.event,
	D.version,
	D.setView,
	D.sound,
	D.time,
	D.print,
	D.stuffText,
	D.setAngle,
	D.serverInfo,
	D.lightStyle,
	D.updateUserInfo,
	D.deltaDescription,
	D.clientData,
	D.stopSound,
	D.pings,
	D.particle,
	D.damage,
	D.spawnStatic,
	D.eventReliable,
	D.spawnBaseLine,
	D.tempEntity,
	D.setPause,
	D.signOnNum,
	D.centerPrint,
	D.killedMonster,
	D.foundSecret,
	D.spawnStaticSound,
	D.intermission,
	D.finale,
	D.cdTrack,
	D.restore,
	D.cutscene,
	D.weaponAnim,
	D.decalName,
	D.roomType,
	D.addAngle,
	D.newUserMsg,
	D.packetEntities,
	D.deltaPacketEntities,
	D.choke,
	D.resourceList,
	D.newMoveVars,
	D.resourceRequest,
	D.customization,
	D.crosshairAngle,
	D.soundFade,
	D.fileTxferFailed,
	D.hltv,
	D.director,
	D.voiceInit,
	D.voiceData,
	D.sendExtraInfo,
	D.timeScale,
	D.resourceLocation,
	D.sendCvarValue,
	D.sendCvarValue2
];
function ie(e, t, n) {
	if (t === 0) return null;
	let r = re[t];
	return r ? r(e, n) : null;
}
var ae = /* @__PURE__ */ function(e) {
	return e[e.BAD = 0] = "BAD", e[e.NOP = 1] = "NOP", e[e.DISCONNECT = 2] = "DISCONNECT", e[e.EVENT = 3] = "EVENT", e[e.VERSION = 4] = "VERSION", e[e.SETVIEW = 5] = "SETVIEW", e[e.SOUND = 6] = "SOUND", e[e.TIME = 7] = "TIME", e[e.PRINT = 8] = "PRINT", e[e.STUFFTEXT = 9] = "STUFFTEXT", e[e.SETANGLE = 10] = "SETANGLE", e[e.SERVERINFO = 11] = "SERVERINFO", e[e.LIGHTSTYLE = 12] = "LIGHTSTYLE", e[e.UPDATEUSERINFO = 13] = "UPDATEUSERINFO", e[e.DELTADESCRIPTION = 14] = "DELTADESCRIPTION", e[e.CLIENTDATA = 15] = "CLIENTDATA", e[e.STOPSOUND = 16] = "STOPSOUND", e[e.PINGS = 17] = "PINGS", e[e.PARTICLE = 18] = "PARTICLE", e[e.DAMAGE = 19] = "DAMAGE", e[e.SPAWN = 20] = "SPAWN", e[e.EVENT_RELIABLE = 21] = "EVENT_RELIABLE", e[e.SPAWNBASELINE = 22] = "SPAWNBASELINE", e[e.TEMPENTITY = 23] = "TEMPENTITY", e[e.SETPAUSE = 24] = "SETPAUSE", e[e.SIGNONNUM = 25] = "SIGNONNUM", e[e.CENTERPRINT = 26] = "CENTERPRINT", e[e.KILLEDMONSTER = 27] = "KILLEDMONSTER", e[e.FOUNDSECRET = 28] = "FOUNDSECRET", e[e.SPAWNSTATICSOUND = 29] = "SPAWNSTATICSOUND", e[e.INTERMISSION = 30] = "INTERMISSION", e[e.FINALE = 31] = "FINALE", e[e.CDTRACK = 32] = "CDTRACK", e[e.RESTORE = 33] = "RESTORE", e[e.CUTSCENE = 34] = "CUTSCENE", e[e.WEAPONANIM = 35] = "WEAPONANIM", e[e.DECALNAME = 36] = "DECALNAME", e[e.ROOMTYPE = 37] = "ROOMTYPE", e[e.ADDANGLE = 38] = "ADDANGLE", e[e.NEWUSERMSG = 39] = "NEWUSERMSG", e[e.PACKETENTITIES = 40] = "PACKETENTITIES", e[e.DELTAPACKETENTITIES = 41] = "DELTAPACKETENTITIES", e[e.CHOKE = 42] = "CHOKE", e[e.RESOURCELIST = 43] = "RESOURCELIST", e[e.NEWMOVEVARS = 44] = "NEWMOVEVARS", e[e.RESOURCEREQUEST = 45] = "RESOURCEREQUEST", e[e.CUSTOMIZATION = 46] = "CUSTOMIZATION", e[e.CROSSHAIRANGLE = 47] = "CROSSHAIRANGLE", e[e.SOUNDFADE = 48] = "SOUNDFADE", e[e.FILETXFERFAILED = 49] = "FILETXFERFAILED", e[e.HLTV = 50] = "HLTV", e[e.DIRECTOR = 51] = "DIRECTOR", e[e.VOICEINIT = 52] = "VOICEINIT", e[e.VOICEDATA = 53] = "VOICEDATA", e[e.SENDEXTRAINFO = 54] = "SENDEXTRAINFO", e[e.TIMESCALE = 55] = "TIMESCALE", e[e.RESOURCELOCATION = 56] = "RESOURCELOCATION", e[e.SENDCVARVALUE = 57] = "SENDCVARVALUE", e[e.SENDCVARVALUE2 = 58] = "SENDCVARVALUE2", e;
}({}), oe = (e) => e.nstr(8) === "HLDEMO", se = (e) => ({
	demoProtocol: e.ui(),
	netProtocol: e.ui(),
	mapName: e.nstr(260),
	modName: e.nstr(260),
	mapCrc: e.i(),
	dirOffset: e.ui()
}), ce = (e, t) => {
	e.seek(t);
	let n = e.ui(), r = [];
	for (let t = 0; t < n; ++t) r.push({
		id: e.ui(),
		name: e.nstr(64),
		flags: e.ui(),
		cdTrack: e.i(),
		time: e.f(),
		frames: e.ui(),
		offset: e.ui(),
		length: e.ui()
	});
	return r;
}, le = (e, t, n) => {
	let r = e.ui(), i = e.tell() + r, a = [];
	for (; e.tell() < i;) {
		let r = e.ub();
		if (r === 1) continue;
		if (r >= 64) {
			let t = n[r], o = t && t.size > -1 ? t.size : e.ub();
			a.push({
				type: r,
				data: {
					index: r,
					name: t?.name || "",
					payload: e.arrx(o, c.UByte)
				}
			});
			continue;
		}
		let o;
		try {
			o = ie(e, r, t);
		} catch (t) {
			// Temp entities are presentation-only. Some historic servers emitted
			// obsolete/private TE variants whose wire size is unavailable. The
			// network packet is length-delimited, so abandon only the remaining
			// cosmetic messages in this packet and keep the demo index intact.
			if (t instanceof Error && (
				(r === 23 && t.message.startsWith("Unknown temp entity type ")) ||
				(r === 22 && t.message === "Bad spawnbaseline")
			)) {
				e.seek(i);
				break;
			}
			throw t;
		}
		o ? (r === 39 &&
			o.index >= 64 && o.index <= 255 &&
			o.size >= -1 &&
			/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(o.name) &&
			(!n[o.index] ||
				(n[o.index].name === o.name && n[o.index].size === o.size)) &&
			(n[o.index] = o), a.push({
			type: r,
			data: o
		})) : e.seek(i);
	}
	return e.seek(i), a;
}, ue = (e, t, n) => {
	let r = {
		type: e.ub(),
		time: e.f(),
		tick: e.ui()
	};
	switch (r.type) {
		case 0:
		case 1:
			e.skip(4), r.camera = {
				position: [
					e.f(),
					e.f(),
					e.f()
				],
				orientation: [
					e.f(),
					e.f(),
					e.f()
				]
			};
			let i = e.tell();
			e.seek(i + 238), r.inputButtons = e.us(), e.seek(i + 436), r.data = le(e, t, n);
			break;
		case 2: break;
		case 3:
			r.command = e.nstr(64);
			break;
		case 4:
			e.skip(32);
			break;
		case 5: break;
		case 6:
			e.skip(84);
			break;
		case 7:
			e.skip(8);
			break;
		case 8:
			r.sound = {
				channel: e.i(),
				sample: e.nstr(e.ui()),
				attenuation: e.f(),
				volume: e.f(),
				flags: e.ui(),
				pitch: e.i()
			};
			break;
		case 9:
			e.skip(e.ui());
			break;
		default: r.error = !0;
	}
	return r;
}, de = class e {
	header;
	mapName;
	directories;
	constructor(e, t) {
		this.header = e, this.mapName = this.header.mapName, this.directories = t;
	}
	static parseFromArrayBuffer(t) {
		let n = new l(t);
		if (n.nstr(8) !== "HLDEMO") throw Error("Invalid replay format");
		let r = {};
		r.demoProtocol = n.ui(), r.netProtocol = n.ui(), r.mapName = n.nstr(260), r.modName = n.nstr(260), r.mapCrc = n.i(), r.dirOffset = n.ui(), n.seek(r.dirOffset);
		let i = n.ui(), a = [];
		for (let e = 0; e < i; ++e) a.push({
			id: n.ui(),
			name: n.nstr(64),
			flags: n.ui(),
			cdTrack: n.i(),
			time: n.f(),
			frames: n.ui(),
			offset: n.ui(),
			length: n.ui(),
			macros: []
		});
		for (let e = 0; e < a.length; ++e) {
			n.seek(a[e].offset);
			let t = !1;
			for (; !t;) {
				let r = {
					type: n.b(),
					time: n.f(),
					frame: n.ui()
				};
				switch (r.type) {
					case 0:
					case 1:
						n.skip(4), r.camera = {
							position: [
								n.f(),
								n.f(),
								n.f()
							],
							orientation: [
								n.f(),
								n.f(),
								n.f()
							]
						}, n.skip(436), n.skip(n.ui());
						break;
					case 2: break;
					case 3:
						r.command = n.nstr(64);
						break;
					case 4:
						n.skip(32);
						break;
					case 5:
						t = !0;
						break;
					case 6:
						n.skip(84);
						break;
					case 7:
						n.skip(8);
						break;
					case 8:
						n.skip(4), n.skip(n.ui() + 16);
						break;
					case 9:
						n.skip(n.ui());
						break;
					default: {
						let e = Number(n.tell() - 9).toString(16), t = [`Unexpected macro (${r.type})`, ` at offset = ${e}.`].join("");
						throw Error(t);
					}
				}
				a[e].macros.push(r);
			}
		}
		return new e(r, a);
	}
	static parseFullFromArrayBuffer(t) {
		let n = new l(t);
		if (n.nstr(8) !== "HLDEMO") throw Error("Invalid replay format");
		let r = {};
		r.demoProtocol = n.ui(), r.netProtocol = n.ui(), r.mapName = n.nstr(260), r.modName = n.nstr(260), r.mapCrc = n.i(), r.dirOffset = n.ui(), n.seek(r.dirOffset);
		let i = n.ui(), a = [];
		for (let e = 0; e < i; ++e) a.push({
			id: n.ui(),
			name: n.nstr(64),
			flags: n.ui(),
			cdTrack: n.i(),
			time: n.f(),
			frames: n.ui(),
			offset: n.ui(),
			length: n.ui(),
			macros: []
		});
		let o = te(), s = [];
		for (let e = 0; e < a.length; ++e) {
			n.seek(a[e].offset);
			let t = !1;
			for (; !t;) {
				let r = {
					type: n.b(),
					time: n.f(),
					frame: n.ui()
				};
				switch (r.type) {
					case 0:
					case 1: {
						n.skip(4), r.camera = {
							position: [
								n.f(),
								n.f(),
								n.f()
							],
							orientation: [
								n.f(),
								n.f(),
								n.f()
							],
							forward: [
								n.f(),
								n.f(),
								n.f()
							],
							right: [
								n.f(),
								n.f(),
								n.f()
							],
							up: [
								n.f(),
								n.f(),
								n.f()
							]
						}, r.RefParams = {
							frametime: n.f(),
							time: n.f(),
							intermission: n.i(),
							paused: n.i(),
							spectator: n.i(),
							onground: n.i(),
							waterlevel: n.i(),
							velocity: [
								n.f(),
								n.f(),
								n.f()
							],
							origin: [
								n.f(),
								n.f(),
								n.f()
							],
							viewHeight: [
								n.f(),
								n.f(),
								n.f()
							],
							idealPitch: n.f(),
							viewAngles: [
								n.f(),
								n.f(),
								n.f()
							],
							health: n.i(),
							crosshairAngle: [
								n.f(),
								n.f(),
								n.f()
							],
							viewSize: n.f(),
							punchAngle: [
								n.f(),
								n.f(),
								n.f()
							],
							maxClients: n.i(),
							viewEntity: n.i(),
							playerCount: n.i(),
							maxEntities: n.i(),
							demoPlayback: n.i(),
							hardware: n.i(),
							smoothing: n.i(),
							ptr_cmd: n.i(),
							ptr_movevars: n.i(),
							viewport: [
								n.i(),
								n.i(),
								n.i(),
								n.i()
							],
							nextView: n.i(),
							onlyClientDraw: n.i()
						}, r.UserCmd = {
							lerp_msec: n.s(),
							msec: n.ub(),
							UNUSED1: n.ub(),
							viewAngles: [
								n.f(),
								n.f(),
								n.f()
							],
							forwardMove: n.f(),
							sideMove: n.f(),
							upMove: n.f(),
							lightLevel: n.b(),
							UNUSED2: n.ub(),
							buttons: n.us(),
							impulse: n.b(),
							weaponSelect: n.b(),
							UNUSED: n.s(),
							impactIndex: n.i(),
							impactPosition: [
								n.f(),
								n.f(),
								n.f()
							]
						}, r.MoveVars = {
							gravity: n.f(),
							stopSpeed: n.f(),
							maxSpeed: n.f(),
							spectatorMaxSpeed: n.f(),
							acceleration: n.f(),
							airAcceleration: n.f(),
							waterAcceleration: n.f(),
							friction: n.f(),
							edgeFriction: n.f(),
							waterFriction: n.f(),
							entityGravity: n.f(),
							bounce: n.f(),
							stepSize: n.f(),
							maxVelocity: n.f(),
							zMax: n.f(),
							waveHeight: n.f(),
							footsteps: n.i(),
							skyName: n.nstr(32),
							rollAngle: n.f(),
							rollSpeed: n.f(),
							skyColor: [
								n.f(),
								n.f(),
								n.f()
							],
							skyVec: [
								n.f(),
								n.f(),
								n.f()
							]
						}, r.view = [
							n.f(),
							n.f(),
							n.f()
						], r.viewModel = n.i(), r.incoming_sequence = n.i(), r.incoming_acknowledged = n.i(), r.incoming_reliable_acknowledged = n.i(), r.incoming_reliable_sequence = n.i(), r.outgoing_sequence = n.i(), r.reliable_sequence = n.i(), r.last_reliable_sequence = n.i();
						let e = n.ui() + n.tell();
						for (r.frameData = []; n.tell() < e;) {
							let t = n.ub();
							if (t === 1) continue;
							if (t >= 64) {
								s[t] && s[t].size > -1 ? n.skip(s[t].size) : n.skip(n.ub());
								continue;
							}
							let i = ie(n, t, o);
							i ? (t === 39 && (s[i.index] = i), r.frameData.push({
								type: t,
								frameData: i
							})) : n.seek(e);
						}
						n.seek(e);
						break;
					}
					case 2: break;
					case 3:
						r.command = n.nstr(64);
						break;
					case 4:
						r.clientData = {
							position: [
								n.f(),
								n.f(),
								n.f()
							],
							rotation: [
								n.f(),
								n.f(),
								n.f()
							],
							weaponFlags: n.ui(),
							fov: n.f()
						};
						break;
					case 5:
						t = !0;
						break;
					case 6:
						r.event = {
							flags: n.ui(),
							index: n.ui(),
							delay: n.f(),
							args: {
								flags: n.ui(),
								entityIndex: n.ui(),
								position: [
									n.f(),
									n.f(),
									n.f()
								],
								rotation: [
									n.f(),
									n.f(),
									n.f()
								],
								velocity: [
									n.f(),
									n.f(),
									n.f()
								],
								ducking: n.ui(),
								fparam1: n.f(),
								fparam2: n.f(),
								iparam1: n.i(),
								iparam2: n.i(),
								bparam1: n.i(),
								bparam2: n.i()
							}
						};
						break;
					case 7:
						r.weaponAnimation = {
							animation: n.i(),
							body: n.i()
						};
						break;
					case 8:
						r.sound = {
							channel: n.i(),
							sample: n.nstr(n.ui()),
							attenuation: n.f(),
							volume: n.f(),
							flags: n.ui(),
							pitch: n.i()
						};
						break;
					case 9:
						n.skip(n.ui());
						break;
					default: {
						let e = Number(n.tell() - 9).toString(16), t = `Unexpected macro (${r.type}) at offset = ${e}`;
						throw Error(t);
					}
				}
				a[e].macros.push(r);
			}
		}
		return new e(r, a);
	}
	static parseIntoChunks(e) {
		let t = new l(e);
		if (!oe(t)) throw Error("Invalid replay file format");
		let n = [], r = te(), i = [], a = ce(t, se(t).dirOffset), o, s, u, d, f = new S(), p = a[0].offset + a[0].length;
		for (t.seek(a[0].offset); t.tell() < p;) {
			let e = ue(t, r, i);
			if (f.feedFrame(e), e.error) throw Error("Encountered error while reading replay");
			if (e.type < 2) {
				let t = e.data.find((e) => e.type === ae.SERVERINFO);
				t && (o = new b(t.data.mapFileName), n.push(o));
				let r = e.data.find((e) => e.type === ae.RESOURCELIST);
				r && o && o.setResources(r.data);
			}
		}
		if (!(o instanceof b)) throw Error("Error while parsing replay.");
		for (d = t.tell(), s = new x(f, 0), o.addChunk(s), p = a[1].offset + a[1].length, t.seek(a[1].offset);;) {
			let e = t.tell();
			if (e >= p) {
				let n = u.time - s.startTime;
				s.timeLength = n;
				let r = e - d;
				t.seek(d), s.setData(t.arrx(r, c.UByte)), t.seek(e);
				break;
			}
			let a = ue(t, r, i);
			if (f.feedFrame(a), u = a, a.error) throw Error("Encountered error while reading replay");
			if (a.type < 2) {
				let r = a.data.find((e) => e.type === ae.SERVERINFO);
				if (r) {
					o = new b(r.data.mapFileName), n.push(o);
					let i = u.time - s.startTime;
					s.timeLength = i;
					let l = e - d, p = t.tell();
					t.seek(d), s.setData(t.arrx(l, c.UByte)), t.seek(p), d = e, s = new x(f, a.time), o.addChunk(s);
				}
				let i = a.data.find((e) => e.type === ae.RESOURCELIST);
				if (i && o.setResources(i.data), r) continue;
				for (let e = 0; e < a.data.length; ++e) {
					let t = a.data[e];
					if (t.type === ae.SOUND || t.type === ae.SPAWNSTATICSOUND) {
						let e = o.resources.sounds.find((e) => e.index === t.data.soundIndex);
						e && (e.used = !0);
					} else if (t.type === ae.STUFFTEXT) {
						let e = o.resources.sounds, n = t.data.commands;
						for (let t = 0; t < n.length; ++t) {
							let r = n[t], i = r.func;
							if ((i === "speak" || i === "spk") && r.params.length === 1) {
								let t = `${r.params[0]}.wav`, n = e.find((e) => e.name === t);
								n && (n.used = !0);
							}
						}
					}
				}
			} else if (a.type === 8) {
				let e = o.resources.sounds.find((e) => e.name === a.sound.sample);
				e && (e.used = !0);
			}
			if (s.startTime + 10 < a.time) {
				let n = e - d, r = t.tell();
				t.seek(d), s.setData(t.arrx(n, c.UByte)), t.seek(r), d = e, s = new x(f, a.time), o.addChunk(s);
			}
		}
		return {
			length: a[1].time,
			maps: n,
			deltaDecoders: r,
			customMessages: i
		};
	}
	static parseAnalysisFrames(e, h) {
		let t = new l(e);
		if (!oe(t)) throw Error("Invalid replay file format");
		let n = te(), r = [], i = se(t), a = ce(t, i.dirOffset), o = [], s = 0, u = a.length, d = a.reduce((e, t) => e + t.length, 0), f = 0, m = [], v = [];
		for (let e = 0; e < a.length; ++e) {
			let i = a[e], c = i.offset + i.length, p = i.offset, q = i.length;
			t.seek(i.offset);
			for (; t.tell() < c;) {
				let i = t.tell(), a = ue(t, n, r), c = s++;
				if (a.error) throw Error(`Encountered error while reading replay at offset ${i}`);
				h && c % 256 === 0 && h({ currentBytes: f + Math.max(0, Math.min(t.tell() - p, q)), totalBytes: d, demoTime: a.time, packetOrdinal: c, directoryEntry: e, directoryCount: u });
				if (a.type === 5) break;
				if (a.type > 1 || !a.data) continue;
				for (let e of a.data) if (e.type === 22 && e.data?.entities) {
					for (let t = 0; t < e.data.entities.length; ++t) e.data.entities[t] && (m[t] = { ...(m[t] || {}), ...e.data.entities[t] });
				} else if (e.type === 40 && e.data?.entityStates) {
					let t = [];
					for (let n = 0; n < e.data.entityStates.length; ++n) e.data.entityStates[n] && (t[n] = { ...(m[n] || {}), ...e.data.entityStates[n] });
					v = t;
				} else if (e.type === 41 && e.data?.entityStates) {
					for (let t = 0; t < e.data.entityStates.length; ++t) {
						let n = e.data.entityStates[t];
						n && (n.__remove ? delete v[t] : v[t] = { ...(v[t] || m[t] || {}), ...n });
					}
				}
				let l = a.data.filter((e) => e.type === 3 || e.type === 11 || e.type === 13 || e.type === 21 || e.type === 39 || e.type === 43 || e.type === 50 || e.type === 51 || e.type >= 64);
				if (l.length) {
					let y = [], g = [], b = [], w = [];
					for (let e = 1; e < v.length; ++e) if (v[e]) {
						y.push(e);
						let t = Object.keys(v[e]);
						let n = ["origin[0]", "origin[1]", "origin[2]"].every((e) => t.includes(e)), r = ["angles[0]", "angles[1]"].every((e) => t.includes(e));
						n && g.push(e), r && b.push(e), (n || r) && w.push({
							slot: e,
							position: n ? [Number(v[e]["origin[0]"]), Number(v[e]["origin[1]"]), Number(v[e]["origin[2]"])] : null,
							angles: r ? [Number(v[e]["angles[0]"]), Number(v[e]["angles[1]"]), Number(v[e]["angles[2]"] || 0)] : null
						});
					}
					o.push({
					time: a.time,
					tick: a.tick,
					inputButtons: a.inputButtons,
					packetOrdinal: c,
					directoryEntry: e,
					byteOffset: i,
					messages: l,
					entitySlots: y,
					positionSlots: g,
					angleSlots: b,
					playerEntities: w
					});
				}
			}
			f += i.length, h && h({ currentBytes: f, totalBytes: d, demoTime: i.time, packetOrdinal: Math.max(0, s - 1), directoryEntry: e, directoryCount: u });
		}
		return {
			header: i,
			directories: a,
			frames: o,
			customMessages: r
		};
	}
	static readHeader(e) {
		return se(e);
	}
	static readDirectories(e, t) {
		return ce(e, t);
	}
	static readFrame(e, t, n) {
		return ue(e, t, n);
	}
	static readFrameData(e, t, n) {
		return ue(e, t, n);
	}
}, O = /* @__PURE__ */ function(e) {
	return e[e.VP_PARALLEL_UPRIGHT = 0] = "VP_PARALLEL_UPRIGHT", e[e.FACING_UPRIGHT = 1] = "FACING_UPRIGHT", e[e.VP_PARALLEL = 2] = "VP_PARALLEL", e[e.ORIENTED = 3] = "ORIENTED", e[e.VP_PARALLEL_ORIENTED = 4] = "VP_PARALLEL_ORIENTED", e;
}({}), fe = class e {
	header;
	frames;
	constructor(e, t) {
		this.header = e, this.frames = t;
	}
	static parse(t) {
		let n = new l(t);
		if (n.nstr(4) !== "IDSP") throw Error("Invalid sprite file format");
		let r = {
			version: n.i(),
			type: n.i(),
			alphaType: n.i(),
			radius: n.f(),
			width: n.i(),
			height: n.i(),
			frameCount: n.i(),
			beamLength: n.f(),
			syncType: n.i()
		}, i = n.s(), a = n.arrx(i * 3, c.UByte), o = [];
		for (let e = 0; e < r.frameCount; ++e) {
			let e = {
				group: n.i(),
				position: [n.i(), n.i()],
				width: n.i(),
				height: n.i(),
				data: new Uint8Array(r.width * r.height * 4)
			}, t = n.arrx(r.width * r.height, c.UByte);
			e.data = r.alphaType === 3 ? f(t, a) : d(t, a), o.push(e);
		}
		return new e(r, o);
	}
};
//#endregion
//#region src/Xhr.ts
function pe(e, t) {
	let n = t.method || "GET", r = t.isBinary, i = t.progressCallback;
	if (!e) throw Error("Url parameter missing");
	return new Promise((t, a) => {
		let o = new XMLHttpRequest();
		r && (o.responseType = "arraybuffer"), r && i && o.addEventListener("progress", (e) => {
			if (e.lengthComputable) i(o, e.loaded / e.total);
			else {
				let t = o.getResponseHeader("content-length"), n = 0;
				t && (n = Number.parseFloat(t));
				let r = o.getResponseHeader("content-encoding");
				if (n && r && r.indexOf("gzip") > -1) {
					n *= 4;
					let t = Math.min(.99, e.loaded / n);
					i(o, t);
				} else i(o, 0);
			}
		}), o.addEventListener("readystatechange", () => {
			o.readyState === 4 && (o.status === 200 ? (i && i(o, 1), t(o.response)) : a({ status: o.status }));
		}), o.open(n, e, !0), o.send();
	});
}
//#endregion
//#region node_modules/.pnpm/gl-matrix@3.4.4/node_modules/gl-matrix/esm/common.js
var k = typeof Float32Array < "u" ? Float32Array : Array, me = Math.PI / 180;
180 / Math.PI;
function he(e) {
	return e * me;
}
//#endregion
//#region node_modules/.pnpm/gl-matrix@3.4.4/node_modules/gl-matrix/esm/mat4.js
function ge() {
	var e = new k(16);
	return k != Float32Array && (e[1] = 0, e[2] = 0, e[3] = 0, e[4] = 0, e[6] = 0, e[7] = 0, e[8] = 0, e[9] = 0, e[11] = 0, e[12] = 0, e[13] = 0, e[14] = 0), e[0] = 1, e[5] = 1, e[10] = 1, e[15] = 1, e;
}
function _e(e) {
	return e[0] = 1, e[1] = 0, e[2] = 0, e[3] = 0, e[4] = 0, e[5] = 1, e[6] = 0, e[7] = 0, e[8] = 0, e[9] = 0, e[10] = 1, e[11] = 0, e[12] = 0, e[13] = 0, e[14] = 0, e[15] = 1, e;
}
function ve(e, t, n) {
	var r = n[0], i = n[1], a = n[2], o, s, c, l, u, d, f, p, m, h, g, _;
	return t === e ? (e[12] = t[0] * r + t[4] * i + t[8] * a + t[12], e[13] = t[1] * r + t[5] * i + t[9] * a + t[13], e[14] = t[2] * r + t[6] * i + t[10] * a + t[14], e[15] = t[3] * r + t[7] * i + t[11] * a + t[15]) : (o = t[0], s = t[1], c = t[2], l = t[3], u = t[4], d = t[5], f = t[6], p = t[7], m = t[8], h = t[9], g = t[10], _ = t[11], e[0] = o, e[1] = s, e[2] = c, e[3] = l, e[4] = u, e[5] = d, e[6] = f, e[7] = p, e[8] = m, e[9] = h, e[10] = g, e[11] = _, e[12] = o * r + u * i + m * a + t[12], e[13] = s * r + d * i + h * a + t[13], e[14] = c * r + f * i + g * a + t[14], e[15] = l * r + p * i + _ * a + t[15]), e;
}
function ye(e, t, n) {
	var r = n[0], i = n[1], a = n[2];
	return e[0] = t[0] * r, e[1] = t[1] * r, e[2] = t[2] * r, e[3] = t[3] * r, e[4] = t[4] * i, e[5] = t[5] * i, e[6] = t[6] * i, e[7] = t[7] * i, e[8] = t[8] * a, e[9] = t[9] * a, e[10] = t[10] * a, e[11] = t[11] * a, e[12] = t[12], e[13] = t[13], e[14] = t[14], e[15] = t[15], e;
}
function be(e, t, n) {
	var r = Math.sin(n), i = Math.cos(n), a = t[4], o = t[5], s = t[6], c = t[7], l = t[8], u = t[9], d = t[10], f = t[11];
	return t !== e && (e[0] = t[0], e[1] = t[1], e[2] = t[2], e[3] = t[3], e[12] = t[12], e[13] = t[13], e[14] = t[14], e[15] = t[15]), e[4] = a * i + l * r, e[5] = o * i + u * r, e[6] = s * i + d * r, e[7] = c * i + f * r, e[8] = l * i - a * r, e[9] = u * i - o * r, e[10] = d * i - s * r, e[11] = f * i - c * r, e;
}
function xe(e, t, n) {
	var r = Math.sin(n), i = Math.cos(n), a = t[0], o = t[1], s = t[2], c = t[3], l = t[8], u = t[9], d = t[10], f = t[11];
	return t !== e && (e[4] = t[4], e[5] = t[5], e[6] = t[6], e[7] = t[7], e[12] = t[12], e[13] = t[13], e[14] = t[14], e[15] = t[15]), e[0] = a * i - l * r, e[1] = o * i - u * r, e[2] = s * i - d * r, e[3] = c * i - f * r, e[8] = a * r + l * i, e[9] = o * r + u * i, e[10] = s * r + d * i, e[11] = c * r + f * i, e;
}
function A(e, t, n) {
	var r = Math.sin(n), i = Math.cos(n), a = t[0], o = t[1], s = t[2], c = t[3], l = t[4], u = t[5], d = t[6], f = t[7];
	return t !== e && (e[8] = t[8], e[9] = t[9], e[10] = t[10], e[11] = t[11], e[12] = t[12], e[13] = t[13], e[14] = t[14], e[15] = t[15]), e[0] = a * i + l * r, e[1] = o * i + u * r, e[2] = s * i + d * r, e[3] = c * i + f * r, e[4] = l * i - a * r, e[5] = u * i - o * r, e[6] = d * i - s * r, e[7] = f * i - c * r, e;
}
function Se(e, t, n, r, i) {
	var a = 1 / Math.tan(t / 2);
	if (e[0] = a / n, e[1] = 0, e[2] = 0, e[3] = 0, e[4] = 0, e[5] = a, e[6] = 0, e[7] = 0, e[8] = 0, e[9] = 0, e[11] = -1, e[12] = 0, e[13] = 0, e[15] = 0, i != null && i !== Infinity) {
		var o = 1 / (r - i);
		e[10] = (i + r) * o, e[14] = 2 * i * r * o;
	} else e[10] = -1, e[14] = -2 * r;
	return e;
}
var Ce = Se;
//#endregion
//#region node_modules/.pnpm/gl-matrix@3.4.4/node_modules/gl-matrix/esm/vec3.js
function we() {
	var e = new k(3);
	return k != Float32Array && (e[0] = 0, e[1] = 0, e[2] = 0), e;
}
function Te(e) {
	var t = new k(3);
	return t[0] = e[0], t[1] = e[1], t[2] = e[2], t;
}
function j(e, t, n) {
	var r = new k(3);
	return r[0] = e, r[1] = t, r[2] = n, r;
}
function Ee(e, t, n) {
	return e[0] = t[0] + n[0], e[1] = t[1] + n[1], e[2] = t[2] + n[2], e;
}
function De(e, t, n) {
	return e[0] = t[0] * n, e[1] = t[1] * n, e[2] = t[2] * n, e;
}
function Oe(e, t) {
	var n = t[0] - e[0], r = t[1] - e[1], i = t[2] - e[2];
	return Math.sqrt(n * n + r * r + i * i);
}
var ke = Oe;
(function() {
	var e = we();
	return function(t, n, r, i, a, o) {
		var s, c;
		for (n ||= 3, r ||= 0, c = i ? Math.min(i * n + r, t.length) : t.length, s = r; s < c; s += n) e[0] = t[s], e[1] = t[s + 1], e[2] = t[s + 2], a(e, e, o), t[s] = e[0], t[s + 1] = e[1], t[s + 2] = e[2];
		return t;
	};
})();
//#endregion
//#region node_modules/.pnpm/gl-matrix@3.4.4/node_modules/gl-matrix/esm/vec2.js
function Ae() {
	var e = new k(2);
	return k != Float32Array && (e[0] = 0, e[1] = 0), e;
}
(function() {
	var e = Ae();
	return function(t, n, r, i, a, o) {
		var s, c;
		for (n ||= 2, r ||= 0, c = i ? Math.min(i * n + r, t.length) : t.length, s = r; s < c; s += n) e[0] = t[s], e[1] = t[s + 1], a(e, e, o), t[s] = e[0], t[s + 1] = e[1];
		return t;
	};
})();
//#endregion
//#region src/Parsers/Vdf.ts
function je(e) {
	let t = 0, n = "", r = "", i = [];
	for (let a = 0; a < e.length; ++a) {
		let o = e[a];
		switch (t) {
			case 0:
				if (/\s/.test(o)) continue;
				if (o === "{") i.push({}), t = 1;
				else return [];
				break;
			case 1:
				if (/\s/.test(o)) continue;
				if (o === "}") t = 0;
				else if (o === "\"") n = "", t = 2;
				else return [];
				break;
			case 2:
				o === "\"" ? t = 3 : n += o;
				break;
			case 3:
				if (/\s/.test(o)) continue;
				o === "\"" && (r = "", t = 4);
				break;
			case 4: o === "\"" ? (i[i.length - 1][n] = r, t = 1) : r += o;
		}
	}
	return i;
}
//#endregion
//#region src/Bsp.ts
var Me = class {
	name;
	entities;
	textures;
	models;
	lightmap;
	skies = [];
	sprites = {};
	constructor(e, t, n, r, i) {
		this.name = e, this.entities = t, this.textures = n, this.models = r, this.lightmap = i;
	}
}, Ne = class e {
	static TEXTURE_SIZE = 1024;
	static init(t) {
		return new e(t);
	}
	lightmap;
	texture;
	block = new Uint16Array(e.TEXTURE_SIZE);
	constructor(t) {
		this.lightmap = t, this.texture = new Uint8Array(e.TEXTURE_SIZE * e.TEXTURE_SIZE * 4), this.texture[this.texture.length - 4] = 255, this.texture[this.texture.length - 3] = 255, this.texture[this.texture.length - 2] = 255, this.texture[this.texture.length - 1] = 255;
	}
	getTexture() {
		return this.texture;
	}
	processFace(t, n, r) {
		let i = this.getDimensions(t), a = this.readLightmap(r, i.width, i.height);
		if (a) for (let r = 0; r < t.length / 7; ++r) {
			let o = t[r * 7] * n.s[0] + t[r * 7 + 1] * n.s[1] + t[r * 7 + 2] * n.s[2] + n.sShift - i.minU;
			o += a.x * 16 + 8, o /= e.TEXTURE_SIZE * 16;
			let s = t[r * 7] * n.t[0] + t[r * 7 + 1] * n.t[1] + t[r * 7 + 2] * n.t[2] + n.tShift - i.minV;
			s += a.y * 16 + 8, s /= e.TEXTURE_SIZE * 16, t[r * 7 + 5] = o, t[r * 7 + 6] = s;
		}
	}
	getDimensions(e) {
		let t = Math.floor(e[3]), n = Math.floor(e[4]), r = Math.floor(e[3]), i = Math.floor(e[4]);
		for (let a = 1; a < e.length / 7; ++a) Math.floor(e[a * 7 + 3]) < t && (t = Math.floor(e[a * 7 + 3])), Math.floor(e[a * 7 + 4]) < n && (n = Math.floor(e[a * 7 + 4])), Math.floor(e[a * 7 + 3]) > r && (r = Math.floor(e[a * 7 + 3])), Math.floor(e[a * 7 + 4]) > i && (i = Math.floor(e[a * 7 + 4]));
		return {
			width: Math.ceil(r / 16) - Math.floor(t / 16) + 1,
			height: Math.ceil(i / 16) - Math.floor(n / 16) + 1,
			minU: Math.floor(t),
			minV: Math.floor(n)
		};
	}
	readLightmap(t, n, r) {
		if (r <= 0 || n <= 0) return null;
		let i = this.findFreeSpace(n, r);
		if (i) {
			let a = [i.x, i.y], o = [n, r], s = [e.TEXTURE_SIZE, e.TEXTURE_SIZE], c = n * r;
			for (let e = 0; e < c; ++e) {
				let n = a[1] * s[0] + a[0] + s[0] * Math.floor(e / o[0]) + e % o[0];
				this.texture[n * 4] = Math.min(255, this.lightmap[t + e * 3] * 2), this.texture[n * 4 + 1] = Math.min(255, this.lightmap[t + e * 3 + 1] * 2), this.texture[n * 4 + 2] = Math.min(255, this.lightmap[t + e * 3 + 2] * 2), this.texture[n * 4 + 3] = 255;
			}
		}
		return i;
	}
	findFreeSpace(t, n) {
		let r = 0, i = 0, a = e.TEXTURE_SIZE;
		for (let e = 0; e < this.block.length - t; ++e) {
			let n = 0, o = 0;
			for (; o < t && !(this.block[e + o] >= a); ++o) this.block[e + o] > n && (n = this.block[e + o]);
			o === t && (r = e, i = a = n);
		}
		if (a + n > e.TEXTURE_SIZE) return null;
		for (let e = 0; e < t; ++e) this.block[r + e] = a + n;
		return {
			x: r,
			y: i
		};
	}
};
//#endregion
//#region src/Parsers/BspParser.ts
function Pe(e, t, n, r, i, a, o, s) {
	let c = [];
	for (let l = 0; l < e.length; ++l) {
		let u = e[l], d = [], f = /* @__PURE__ */ new Float32Array(3), p = /* @__PURE__ */ new Float32Array(3), m = /* @__PURE__ */ new Float32Array(3), h = /* @__PURE__ */ new Float32Array(2), g = /* @__PURE__ */ new Float32Array(2), _ = /* @__PURE__ */ new Float32Array(2), v = /* @__PURE__ */ new Float32Array(2), y = /* @__PURE__ */ new Float32Array(2), b = /* @__PURE__ */ new Float32Array(2), x = l === 0 ? [
			0,
			0,
			0
		] : [
			0,
			0,
			0
		].map((e, t) => (u.maxs[t] - u.mins[t]) / 2 + u.mins[t]), S = j(x[0], x[1], x[2]);
		for (let e = u.firstFace; e < u.firstFace + u.faceCount; ++e) {
			let c = {
				buffer: new Float32Array((t[e].edgeCount - 2) * 21),
				textureIndex: -1
			}, l = a[t[e].textureInfo], u = o[l.textureIndex], x = r.slice(t[e].firstEdge, t[e].firstEdge + t[e].edgeCount), C = n[Math.abs(x[0])][x[0] > 0 ? 0 : 1];
			f[0] = i[C][0], f[1] = i[C][1], f[2] = i[C][2], h[0] = f[0] * l.s[0] + f[1] * l.s[1] + f[2] * l.s[2] + l.sShift, h[1] = f[0] * l.t[0] + f[1] * l.t[1] + f[2] * l.t[2] + l.tShift, v[0] = 0, v[1] = 0;
			let w = n[Math.abs(x[1])][x[1] > 0 ? 0 : 1];
			p[0] = i[w][0], p[1] = i[w][1], p[2] = i[w][2], g[0] = p[0] * l.s[0] + p[1] * l.s[1] + p[2] * l.s[2] + l.sShift, g[1] = p[0] * l.t[0] + p[1] * l.t[1] + p[2] * l.t[2] + l.tShift, y[0] = 0, y[1] = .999;
			let T = 0;
			for (let r = 2; r < t[e].edgeCount; ++r) {
				let e = n[Math.abs(x[r])][x[r] > 0 ? 0 : 1];
				m[0] = i[e][0], m[1] = i[e][1], m[2] = i[e][2], _[0] = m[0] * l.s[0] + m[1] * l.s[1] + m[2] * l.s[2] + l.sShift, _[1] = m[0] * l.t[0] + m[1] * l.t[1] + m[2] * l.t[2] + l.tShift, b[0] = .999, b[1] = .999, c.buffer[T++] = f[0], c.buffer[T++] = f[1], c.buffer[T++] = f[2], c.buffer[T++] = h[0], c.buffer[T++] = h[1], c.buffer[T++] = v[0], c.buffer[T++] = v[1], c.buffer[T++] = p[0], c.buffer[T++] = p[1], c.buffer[T++] = p[2], c.buffer[T++] = g[0], c.buffer[T++] = g[1], c.buffer[T++] = y[0], c.buffer[T++] = y[1], c.buffer[T++] = m[0], c.buffer[T++] = m[1], c.buffer[T++] = m[2], c.buffer[T++] = _[0], c.buffer[T++] = _[1], c.buffer[T++] = b[0], c.buffer[T++] = b[1], p[0] = m[0], p[1] = m[1], p[2] = m[2], g[0] = _[0], g[1] = _[1], y[0] = b[0], y[1] = b[1];
			}
			(l.flags === 0 || l.flags === -65536) && s.processFace(c.buffer, l, t[e].lightmapOffset), c.textureIndex = l.textureIndex;
			for (let e = 0; e < c.buffer.length / 7; ++e) c.buffer[e * 7] -= S[0], c.buffer[e * 7 + 1] -= S[1], c.buffer[e * 7 + 2] -= S[2], c.buffer[e * 7 + 3] /= u.width, c.buffer[e * 7 + 4] /= u.height;
			d.push(c);
		}
		c.push({
			origin: S,
			faces: d
		});
	}
	return c;
}
var Fe = {
	parse(e, t) {
		let n = new l(t);
		if (n.ui() !== 30) throw Error("Invalid map version");
		let r = [];
		for (let e = 0; e < 15; ++e) r.push({
			offset: n.ui(),
			length: n.ui()
		});
		let i = this.loadEntities(n, r[0].offset, r[0].length), a = this.loadTextures(n, r[2].offset), o = this.loadModels(n, r[14].offset, r[14].length), s = this.loadFaces(n, r[7].offset, r[7].length), c = this.loadEdges(n, r[12].offset, r[12].length), u = this.loadSurfEdges(n, r[13].offset, r[13].length), d = this.loadVertices(n, r[3].offset, r[3].length), f = this.loadTexInfo(n, r[6].offset, r[6].length), p = this.loadLightmap(n, r[8].offset, r[8].length), m = Ne.init(p);
		return new Me(e, i, a, Pe(o, s, c, u, d, f, a, m), {
			width: Ne.TEXTURE_SIZE,
			height: Ne.TEXTURE_SIZE,
			data: m.getTexture()
		});
	},
	loadFaces(e, t, n) {
		e.seek(t);
		let r = [];
		for (let t = 0; t < n / 20; ++t) r.push({
			plane: e.us(),
			planeSide: e.us(),
			firstEdge: e.ui(),
			edgeCount: e.us(),
			textureInfo: e.us(),
			styles: [
				e.ub(),
				e.ub(),
				e.ub(),
				e.ub()
			],
			lightmapOffset: e.ui()
		});
		return r;
	},
	loadModels(e, t, n) {
		e.seek(t);
		let r = [];
		for (let t = 0; t < n / 64; ++t) r.push({
			mins: [
				e.f(),
				e.f(),
				e.f()
			],
			maxs: [
				e.f(),
				e.f(),
				e.f()
			],
			origin: j(e.f(), e.f(), e.f()),
			headNodes: [
				e.i(),
				e.i(),
				e.i(),
				e.i()
			],
			visLeaves: e.i(),
			firstFace: e.i(),
			faceCount: e.i()
		});
		return r;
	},
	loadEdges(e, t, n) {
		e.seek(t);
		let r = [];
		for (let t = 0; t < n / 4; ++t) r.push([e.us(), e.us()]);
		return r;
	},
	loadSurfEdges(e, t, n) {
		e.seek(t);
		let r = [];
		for (let t = 0; t < n / 4; ++t) r.push(e.i());
		return r;
	},
	loadVertices(e, t, n) {
		e.seek(t);
		let r = [];
		for (let t = 0; t < n / 12; ++t) r.push([
			e.f(),
			e.f(),
			e.f()
		]);
		return r;
	},
	loadTexInfo(e, t, n) {
		e.seek(t);
		let r = [];
		for (let t = 0; t < n / 40; ++t) r.push({
			s: [
				e.f(),
				e.f(),
				e.f()
			],
			sShift: e.f(),
			t: [
				e.f(),
				e.f(),
				e.f()
			],
			tShift: e.f(),
			textureIndex: e.i(),
			flags: e.i()
		});
		return r;
	},
	loadLightmap(e, t, n) {
		return e.seek(t), e.arrx(n, c.UByte);
	},
	loadTextureData(e) {
		let t = e.nstr(16), n = e.ui(), r = e.ui(), i = !e.ui();
		if (i) {
			let e = /* @__PURE__ */ new Uint8Array(4);
			return e[0] = e[1] = e[2] = e[3] = 255, {
				name: t,
				width: n,
				height: r,
				data: e,
				isExternal: i
			};
		}
		e.skip(12);
		let a = n * r, o = e.arrx(a, c.UByte);
		e.skip(a / 64 * 21), e.skip(2);
		let s = e.arrx(768, c.UByte);
		return {
			name: t,
			width: n,
			height: r,
			data: t[0] === "{" ? f(o, s) : d(o, s),
			isExternal: i
		};
	},
	loadTextures(e, t) {
		e.seek(t);
		let n = e.ui(), r = [];
		for (let t = 0; t < n; ++t) r.push(e.ui());
		let i = [];
		for (let a = 0; a < n; ++a) r[a] === 4294967295 ? i.push({
			name: "ERROR404",
			width: 1,
			height: 1,
			data: new Uint8Array([
				0,
				255,
				0,
				255
			]),
			isExternal: !1
		}) : (e.seek(t + r[a]), i.push(this.loadTextureData(e)));
		return i;
	},
	loadEntities(e, t, n) {
		e.seek(t);
		let r = je(e.nstr(n)), i = [
			"origin",
			"angles",
			"_diffuse_light",
			"_light",
			"rendercolor",
			"avelocity"
		], a = [
			"renderamt",
			"rendermode",
			"scale"
		], s = r[0];
		s.classname === "worldspawn" && (s.model = "*0", s.wad = s.wad || "", s.wad = s.wad.split(";").filter((e) => e.length).map((e) => e.replace(/\\/g, "/")).map((e) => o(e)));
		for (let e of r) {
			e.model && (e.renderamt === void 0 && (e.renderamt = 0), e.rendermode === void 0 && (e.rendermode = 0), e.renderfx === void 0 && (e.renderfx = 0), e.rendercolor === void 0 && (e.rendercolor = "0 0 0"));
			for (let t of i) e[t] && (e[t] = e[t].split(" ").map((e) => Number.parseFloat(e)));
			for (let t of a) e[t] && (e[t] = Number.parseFloat(e[t]));
		}
		return r;
	}
}, Ie = class {
	name;
	progress;
	status;
	data;
	constructor(e) {
		this.name = e, this.progress = 0, this.status = 1, this.data = null;
	}
	isLoading() {
		return this.status === 1;
	}
	skip() {
		this.status = 2;
	}
	isSkipped() {
		return this.status === 2;
	}
	error() {
		this.status = 3;
	}
	isError() {
		return this.status === 3;
	}
	done(e) {
		this.status = 4, this.data = e;
	}
	isDone() {
		return this.status === 4;
	}
}, Le = class extends Ie {
	type = "replay";
}, Re = class extends Ie {
	type = "bsp";
}, ze = class extends Ie {
	type = "sky";
}, Be = class extends Ie {
	type = "wad";
}, Ve = class extends Ie {
	type = "sound";
}, He = class extends Ie {
	type = "sprite";
}, Ue = class {
	config;
	replay;
	map;
	skies;
	wads;
	sounds;
	sprites = {};
	events;
	constructor(t) {
		this.config = t, this.replay = void 0, this.map = void 0, this.skies = [], this.wads = [], this.sounds = [], this.events = e(), this.events.on("error", (e) => {
			console.error(e);
		});
	}
	clear() {
		this.replay = void 0, this.map = void 0, this.skies.length = 0, this.wads.length = 0, this.sounds.length = 0, this.sprites = {};
	}
	checkStatus() {
		if (this.replay && !this.replay.isDone() || this.map && !this.map.isDone()) return;
		for (let e = 0; e < this.skies.length; ++e) if (this.skies[e].isLoading()) return;
		for (let e = 0; e < this.wads.length; ++e) if (this.wads[e].isLoading()) return;
		for (let e = 0; e < this.sounds.length; ++e) if (this.sounds[e].isLoading()) return;
		let e = Object.entries(this.sprites);
		for (let t = 0; t < e.length; ++t) if (e[t][1].isLoading()) return;
		this.events.emit("loadall", this);
	}
	load(e) {
		let t = s(e);
		t === ".dem" ? this.loadReplay(e) : t === ".bsp" ? this.loadMap(e) : this.events.emit("error", "Invalid file extension", e);
	}
	async loadReplay(e) {
		this.replay = new Le(e), this.events.emit("loadstart", this.replay);
		let t = await pe(`${this.config.getReplaysPath()}/${e}`, {
			method: "GET",
			isBinary: !0,
			progressCallback: (e, t) => {
				this.replay && (this.replay.progress = t), this.events.emit("progress", this.replay);
			}
		}).catch((e) => {
			this.replay && this.replay.error(), this.events.emit("error", e, this.replay);
		});
		if (this.replay.isError()) return;
		let n = de.parseIntoChunks(t);
		this.replay.done(n), this.loadMap(`${n.maps[0].name}.bsp`);
		let r = n.maps[0].resources.sounds;
		for (let e of r) e.used && this.loadSound(e.name, e.index);
		this.events.emit("load", this.replay), this.checkStatus();
	}
	async loadMap(e) {
		this.map = new Re(e), this.events.emit("loadstart", this.map);
		let t = await pe(`${this.config.getMapsPath()}/${e}`, {
			method: "GET",
			isBinary: !0,
			progressCallback: (e, t) => {
				this.map && (this.map.progress = t), this.events.emit("progress", this.map);
			}
		}).catch((e) => {
			this.map && this.map.error(), this.events.emit("error", e, this.map);
		});
		if (this.map.isError()) return;
		let n = Fe.parse(e, t);
		this.map.done(n), n.entities.map((e) => {
			if (typeof e.model == "string" && e.model.indexOf(".spr") > -1) return e.model;
		}).filter((e, t, n) => e && n.indexOf(e) === t).map((e) => e && this.loadSprite(e));
		let r = n.entities[0].skyname;
		if (r && [
			"bk",
			"dn",
			"ft",
			"lf",
			"rt",
			"up"
		].map((e) => `${r}${e}`).map((e) => this.loadSky(e)), n.textures.find((e) => e.isExternal)) {
			let e = n.entities[0].wad.map((e) => this.loadWad(e));
			await Promise.all(e);
		}
		this.events.emit("load", this.map), this.checkStatus();
	}
	async loadSprite(e) {
		let t = new He(e);
		this.sprites[e] = t, this.events.emit("loadstart", t);
		let n = await pe(`${this.config.getBasePath()}/${e}`, {
			method: "GET",
			isBinary: !0,
			progressCallback: (e, n) => {
				t.progress = n, this.events.emit("progress", t);
			}
		}).catch((e) => {
			t.error(), this.events.emit("error", e, t), this.checkStatus();
		});
		if (t.isError()) return;
		let r = fe.parse(n);
		t.done(r), this.events.emit("load", t), this.checkStatus();
	}
	async loadSky(e) {
		let t = new ze(e);
		this.skies.push(t), this.events.emit("loadstart", t);
		let n = await pe(`${this.config.getSkiesPath()}/${e}.tga`, {
			method: "GET",
			isBinary: !0,
			progressCallback: (e, n) => {
				t.progress = n, this.events.emit("progress", t);
			}
		}).catch((e) => {
			t.error(), this.events.emit("error", e, t), this.checkStatus();
		});
		if (t.isError()) return;
		let r = u.parse(n, e);
		t.done(r), this.events.emit("load", t), this.checkStatus();
	}
	async loadWad(e) {
		let t = new Be(e);
		this.wads.push(t), this.events.emit("loadstart", t);
		let n = await pe(`${this.config.getWadsPath()}/${e}`, {
			method: "GET",
			isBinary: !0,
			progressCallback: (e, n) => {
				t.progress = n, this.events.emit("progress", t);
			}
		}).catch((e) => {
			t.error(), this.events.emit("error", e, t), this.checkStatus();
		});
		if (t.isError()) return;
		let r = y.parse(n);
		if (t.done(r), !this.map || !this.map.data) return;
		let i = this.map.data, a = (e, t) => e.toLowerCase() === t.toLowerCase();
		for (let e of r.entries) {
			if (e.type !== "texture") return;
			for (let t of i.textures) a(e.name, t.name) && (t.width = e.width, t.height = e.height, t.data = e.data);
		}
		this.events.emit("load", t), this.checkStatus();
	}
	async loadSound(e, t) {
		let n = new Ve(e);
		this.sounds.push(n), this.events.emit("loadstart", n);
		let r = await pe(`${this.config.getSoundsPath()}/${e}`, {
			method: "GET",
			isBinary: !0,
			progressCallback: (e, t) => {
				n.progress = t, this.events.emit("progress", n);
			}
		}).catch((e) => {
			n.error(), this.events.emit("error", e, n), this.checkStatus();
		});
		if (n.isError()) return;
		let i = await a.create(r).catch((e) => {
			n.error(), this.events.emit("error", e, n), this.checkStatus();
		});
		!i || n.isError() || (i.index = t, i.name = e, n.done(i), this.events.emit("load", n), this.checkStatus());
	}
}, We = class {
	click = !1;
	leftClick = !1;
	rightClick = !1;
	position = Ae();
	delta = Ae();
}, Ge = class {
	pressed = !1;
	position = Ae();
	delta = Ae();
}, Ke = class e {
	static init(t) {
		return new e(t);
	}
	projectionMatrix = ge();
	aspect;
	fov = he(60);
	near = 1;
	far = 8192;
	viewMatrix = ge();
	position = we();
	rotation = we();
	constructor(e) {
		this.aspect = e, this.updateProjectionMatrix();
	}
	updateProjectionMatrix() {
		Ce(this.projectionMatrix, this.fov, this.aspect, this.near, this.far);
	}
	updateViewMatrix() {
		_e(this.viewMatrix), be(this.viewMatrix, this.viewMatrix, this.rotation[0] - Math.PI / 2), A(this.viewMatrix, this.viewMatrix, Math.PI / 2 - this.rotation[1]), ve(this.viewMatrix, this.viewMatrix, [
			-this.position[0],
			-this.position[1],
			-this.position[2]
		]);
	}
}, M = class {
	keys;
	constructor() {
		this.keys = /* @__PURE__ */ new Uint8Array(256);
		for (let e = 0; e < 256; ++e) this.keys[0] = 0;
	}
};
(function(e) {
	e.KEYS = /* @__PURE__ */ function(e) {
		return e[e.A = 65] = "A", e[e.B = 66] = "B", e[e.C = 67] = "C", e[e.D = 68] = "D", e[e.E = 69] = "E", e[e.F = 70] = "F", e[e.G = 71] = "G", e[e.H = 72] = "H", e[e.I = 73] = "I", e[e.J = 74] = "J", e[e.K = 75] = "K", e[e.L = 76] = "L", e[e.M = 77] = "M", e[e.N = 78] = "N", e[e.O = 79] = "O", e[e.P = 80] = "P", e[e.Q = 81] = "Q", e[e.R = 82] = "R", e[e.S = 83] = "S", e[e.T = 84] = "T", e[e.U = 85] = "U", e[e.V = 86] = "V", e[e.W = 87] = "W", e[e.X = 88] = "X", e[e.Y = 89] = "Y", e[e.Z = 90] = "Z", e[e.CTRL = 17] = "CTRL", e[e.ALT = 18] = "ALT", e[e.SPACE = 32] = "SPACE", e;
	}({});
})(M ||= {});
//#endregion
//#region src/Graphics/Context.ts
var qe = class e {
	static init(t) {
		let n = t.getContext("webgl", { alpha: !1 });
		return n ? new e(n) : (console.error("Failed to get WebGL context"), null);
	}
	static checkWebGLSupport() {
		let e = {
			BAD_BROWSER: "Your browser does not seem to support WebGL",
			BAD_GPU: "Your graphics card does not seem to support WebGL"
		};
		if (!window.WebGLRenderingContext) return {
			hasSupport: !1,
			message: e.BAD_BROWSER
		};
		let t = document.createElement("canvas");
		try {
			return t.getContext("webgl") || t.getContext("experimental-webgl") ? {
				hasSupport: !0,
				message: ""
			} : {
				hasSupport: !1,
				message: e.BAD_GPU
			};
		} catch {
			return {
				hasSupport: !1,
				message: e.BAD_GPU
			};
		}
	}
	gl;
	constructor(e) {
		this.gl = e;
	}
	createProgram(e) {
		let t = this.gl, n = t.createProgram();
		if (!n) return console.error("Failed to create WebGL program"), null;
		let r = this.createShader({
			source: e.vertexShaderSrc,
			type: 0
		});
		if (!r) return console.error("Failed to compile vertex shader"), null;
		let i = this.createShader({
			source: e.fragmentShaderSrc,
			type: 1
		});
		if (!i) return console.error("Failed to compile fragment shader"), null;
		if (t.attachShader(n, r), t.attachShader(n, i), t.linkProgram(n), t.validateProgram(n), !t.getProgramParameter(n, t.LINK_STATUS)) {
			t.deleteProgram(n), t.deleteShader(r), t.deleteShader(i);
			let e = t.getProgramInfoLog(n);
			return console.error(`Could not initialize shader: ${e}`), null;
		}
		if (!t.getProgramParameter(n, t.VALIDATE_STATUS)) {
			t.deleteProgram(n), t.deleteShader(r), t.deleteShader(i);
			let e = t.getProgramInfoLog(n);
			return console.error(`Could not initialize shader: ${e}`), null;
		}
		t.useProgram(n);
		let a = {};
		for (let r = 0; r < e.attributeNames.length; ++r) {
			let i = e.attributeNames[r], o = t.getAttribLocation(n, i);
			if (o === -1) return console.error(`gl.getAttribLocation failed for attrib named "${i}"`), t.deleteProgram(n), null;
			a[i] = o;
		}
		let o = {};
		for (let r = 0; r < e.uniformNames.length; ++r) {
			let i = e.uniformNames[r], a = t.getUniformLocation(n, i);
			if (a === null) return console.error(`gl.getUniformLocation failed for uniform named "${i}"`), t.deleteProgram(n), null;
			o[i] = a;
		}
		return {
			handle: n,
			attributes: a,
			uniforms: o
		};
	}
	createShader(e) {
		let t = this.gl, n = e.type === 0 ? t.createShader(t.VERTEX_SHADER) : t.createShader(t.FRAGMENT_SHADER);
		return n ? (t.shaderSource(n, e.source), t.compileShader(n), t.getShaderParameter(n, t.COMPILE_STATUS) ? n : (console.error(t.getShaderInfoLog(n)), t.deleteShader(n), null)) : (console.error("Failed to create shader program"), null);
	}
	getAnisotropyExtension() {
		return this.gl.getExtension("EXT_texture_filter_anisotropic") || this.gl.getExtension("MOZ_EXT_texture_filter_anisotropic") || this.gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
	}
	getMaxAnisotropy(e) {
		return this.gl.getParameter(e.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
	}
}, Je = (e, t) => {
	e.camera.position[0] = t.cameraPos[0], e.camera.position[1] = t.cameraPos[1], e.camera.position[2] = t.cameraPos[2], e.camera.rotation[0] = he(t.cameraRot[0]), e.camera.rotation[1] = he(t.cameraRot[1]), e.camera.rotation[2] = he(t.cameraRot[2]);
}, Ye = class {
	game;
	state;
	replay;
	events;
	currentMap = 0;
	currentChunk = 0;
	currentTime = 0;
	currentTick = 0;
	isPlaying = !1;
	isPaused = !1;
	speed = 1;
	constructor(t) {
		this.reset(), this.game = t, this.state = new S(), this.replay = null, this.events = e();
	}
	reset() {
		if (this.currentMap = 0, this.currentChunk = 0, this.currentTime = 0, this.currentTick = 0, this.isPlaying = !1, this.isPaused = !1, this.speed = 1, this.replay) {
			let e = this.replay.maps[0].chunks[0];
			e.reader.seek(0), this.state = e.state.clone();
		}
	}
	changeReplay(e) {
		this.replay = e, this.reset();
	}
	play() {
		this.isPlaying ? this.isPaused &&= !1 : this.isPlaying = !0, this.events.emit("play", this.currentTime);
	}
	pause() {
		this.isPlaying && (this.isPaused = !0), this.events.emit("pause", this.currentTime);
	}
	stop() {
		this.reset(), this.events.emit("stop", 0);
	}
	speedUp() {
		this.speed = Math.min(this.speed * 2, 4);
	}
	speedDown() {
		this.speed = Math.max(this.speed / 2, .25);
	}
	seek(e) {
		let t = Math.max(0, Math.min(this.replay.length, e)), n = this.replay.maps;
		for (let e = 0; e < n.length; ++e) {
			let r = n[e].chunks;
			for (let n = 0; n < r.length; ++n) {
				let i = r[n], a = i.startTime, o = a + i.timeLength;
				if (t >= a && t < o) {
					this.currentMap = e, this.currentChunk = n, this.currentTime = t, this.state = i.state.clone();
					let r = this.replay.deltaDecoders, a = this.replay.customMessages, o = i.reader;
					for (o.seek(0);;) {
						let e = o.tell(), n = de.readFrame(o, r, a);
						if (n.time <= t) this.state.feedFrame(n), this.currentTick = n.tick;
						else {
							o.seek(e);
							break;
						}
					}
					this.events.emit("seek", t), Je(this.game, this.state);
					return;
				}
			}
		}
	}
	seekByPercent(e) {
		this.seek(Math.max(0, Math.min(e, 100)) / 100 * this.replay.length);
	}
	update(e) {
		if (!this.isPlaying || this.isPaused) return;
		let t = this.replay.deltaDecoders, n = this.replay.customMessages, r = this.replay.maps[this.currentMap], i = r.chunks[this.currentChunk], a = i.reader, o = this.currentTime + e * this.speed, s = !1;
		for (;;) {
			let e = a.tell();
			if (e >= i.data.length) {
				if (this.currentChunk === r.chunks.length - 1) {
					if (this.currentMap === this.replay.maps.length - 1) {
						s = !0;
						break;
					}
					this.currentChunk = 0, this.currentMap++, r = this.replay.maps[this.currentMap], i = r.chunks[this.currentChunk];
				} else this.currentChunk++, i = r.chunks[this.currentChunk];
				a = i.reader, a.seek(0), e = 0;
				continue;
			}
			let c = this.game.sounds, l = de.readFrame(a, t, n);
			if (l.type < 2) for (let e = 0; e < l.data.length; ++e) {
				let t = l.data[e];
				if (t.type === 6) {
					let e = t.data, n = c.find((t) => t.index === e.soundIndex);
					if (n && n.name !== "common/null.wav") {
						let t = e.channel, r = e.volume;
						this.game.soundSystem.play(n, t, r);
					}
				} else if (t.type === 29) {
					let e = t.data, n = c.find((t) => t.index === e.soundIndex);
					n && n.name;
				} else if (t.type === 9) for (let e of t.data.commands) switch (e.func) {
					case "speak":
					case "spk":
					case "play": {
						let t = `${e.params[0]}.wav`, n = c.find((e) => e.name === t);
						if (!n) return;
						this.game.soundSystem.play(n, 1, .7);
						break;
					}
					case "playvol": {
						let t = `${e.params[0]}.wav`, n;
						n = Number.isNaN(e.params[1]) ? 1 : Number.parseFloat(e.params[1]);
						let r = c.find((e) => e.name === t);
						if (!r) return;
						this.game.soundSystem.play(r, 1, n);
						break;
					}
				}
			}
			else if (l.type === 8) {
				let e = l.sound.sample, t = c.find((t) => t.name === e);
				if (t && t.name !== "common/null.wav") {
					let e = l.sound.channel, n = l.sound.volume;
					this.game.soundSystem.play(t, e, n);
				}
			}
			if (l.time <= o) this.state.feedFrame(l), this.currentTick = l.tick;
			else {
				a.seek(e);
				break;
			}
		}
		Je(this.game, this.state), this.currentTime = o, s && this.stop();
	}
}, Xe = class e {
	static init(t) {
		let n = t.gl;
		return n.clearColor(0, 0, 0, 1), n.clearDepth(1), n.enable(n.DEPTH_TEST), n.depthFunc(n.LEQUAL), n.enable(n.BLEND), n.blendFunc(n.SRC_ALPHA, n.ONE_MINUS_SRC_ALPHA), n.enable(n.CULL_FACE), n.cullFace(n.FRONT), new e({ context: t });
	}
	context;
	constructor(e) {
		this.context = e.context;
	}
	draw = () => {
		let e = this.context.gl;
		e.clear(e.COLOR_BUFFER_BIT | e.DEPTH_BUFFER_BIT);
	};
}, Ze = "#ifdef GL_ES\nprecision highp float;\n#endif\n\nuniform sampler2D diffuse;\n\nvarying vec2 vTexCoord;\n\nvoid main(void) {\n  vec4 diffuseColor = texture2D(diffuse, vTexCoord);\n  gl_FragColor = vec4(diffuseColor.rgb, 1.0);\n}", Qe = "#ifdef GL_ES\nprecision highp float;\n#endif\n\nattribute vec3 position;\nattribute vec2 texCoord;\n\nvarying vec2 vTexCoord;\n\nuniform mat4 viewMatrix;\nuniform mat4 projectionMatrix;\n\nvoid main(void) {\n  vTexCoord = texCoord;\n  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1);\n}", $e = class e {
	static init(t) {
		let n = t.createProgram({
			vertexShaderSrc: Qe,
			fragmentShaderSrc: Ze,
			attributeNames: ["position", "texCoord"],
			uniformNames: [
				"viewMatrix",
				"projectionMatrix",
				"diffuse"
			]
		});
		return n ? new e(n) : (console.error("Failed to create sky shader program"), null);
	}
	program;
	aPosition;
	aTexCoord;
	uViewMx;
	uProjectionMx;
	uDiffuse;
	constructor(e) {
		this.program = e.handle, this.aPosition = e.attributes.position, this.aTexCoord = e.attributes.texCoord, this.uViewMx = e.uniforms.viewMatrix, this.uProjectionMx = e.uniforms.projectionMatrix, this.uDiffuse = e.uniforms.diffuse;
	}
	useProgram(e) {
		e.useProgram(this.program);
	}
	setViewMatrix(e, t) {
		e.uniformMatrix4fv(this.uViewMx, !1, t);
	}
	setProjectionMatrix(e, t) {
		e.uniformMatrix4fv(this.uProjectionMx, !1, t);
	}
	setDiffuse(e, t) {
		e.uniform1i(this.uDiffuse, t);
	}
	enableVertexAttribs(e) {
		e.enableVertexAttribArray(this.aPosition), e.enableVertexAttribArray(this.aTexCoord);
	}
	setVertexAttribPointers(e) {
		e.vertexAttribPointer(this.aPosition, 3, e.FLOAT, !1, 20, 0), e.vertexAttribPointer(this.aTexCoord, 2, e.FLOAT, !1, 20, 12);
	}
}, et = class e {
	static init(t) {
		let n = $e.init(t);
		return n ? new e({
			context: t,
			shader: n
		}) : (console.error("skyscenen't"), null);
	}
	context;
	shader;
	vertexBuffer = null;
	indexBuffer = null;
	texture = null;
	isReady = !1;
	constructor(e) {
		this.context = e.context, this.shader = e.shader;
	}
	changeMap(e) {
		if (e.skies.length !== 6) {
			this.isReady = !1;
			return;
		}
		let t = this.context.gl, n = t.createBuffer(), r = t.createBuffer(), i = t.createTexture();
		if (!n || !r || !i) throw Error("shouldnt happen");
		let a = new Uint8Array([
			0,
			1,
			2,
			0,
			2,
			3,
			4,
			5,
			6,
			4,
			6,
			7,
			8,
			9,
			10,
			8,
			10,
			11,
			12,
			13,
			14,
			12,
			14,
			15,
			16,
			17,
			18,
			16,
			18,
			19,
			20,
			21,
			22,
			20,
			22,
			23
		]), o = new Float32Array([
			-1,
			-1,
			1,
			.499,
			.001,
			1,
			-1,
			1,
			.499,
			.249,
			1,
			1,
			1,
			.001,
			.249,
			-1,
			1,
			1,
			.001,
			.001,
			-1,
			-1,
			-1,
			.499,
			.749,
			-1,
			1,
			-1,
			.001,
			.749,
			1,
			1,
			-1,
			.001,
			.501,
			1,
			-1,
			-1,
			.499,
			.501,
			-1,
			1,
			-1,
			.501,
			.749,
			-1,
			1,
			1,
			.501,
			.501,
			1,
			1,
			1,
			.999,
			.501,
			1,
			1,
			-1,
			.999,
			.749,
			-1,
			-1,
			-1,
			.999,
			.249,
			1,
			-1,
			-1,
			.501,
			.249,
			1,
			-1,
			1,
			.501,
			.001,
			-1,
			-1,
			1,
			.999,
			.001,
			1,
			-1,
			-1,
			.499,
			.499,
			1,
			1,
			-1,
			.001,
			.499,
			1,
			1,
			1,
			.001,
			.251,
			1,
			-1,
			1,
			.499,
			.251,
			-1,
			-1,
			-1,
			.501,
			.499,
			-1,
			-1,
			1,
			.501,
			.251,
			-1,
			1,
			1,
			.999,
			.251,
			-1,
			1,
			-1,
			.999,
			.499
		].map((e, t) => t % 5 < 3 ? e * 4096 : e));
		t.bindBuffer(t.ARRAY_BUFFER, n), t.bufferData(t.ARRAY_BUFFER, o, t.STATIC_DRAW), t.enableVertexAttribArray(0), t.bindBuffer(t.ELEMENT_ARRAY_BUFFER, r), t.bufferData(t.ELEMENT_ARRAY_BUFFER, a, t.STATIC_DRAW);
		let s = document.createElement("canvas");
		s.width = 512, s.height = 1024;
		let c = s.getContext("2d");
		if (!c) throw Error("sky ctx fail");
		let l = {
			up: [0, 0],
			rt: [0, 256],
			dn: [0, 512],
			ft: [256, 0],
			lf: [256, 256],
			bk: [256, 512]
		};
		for (let t of e.skies) {
			let e = document.createElement("canvas"), n = e.getContext("2d");
			if (!n) throw Error("Runtime error.");
			e.width = t.width, e.height = t.height;
			let r = n.getImageData(0, 0, e.width, e.height);
			for (let e = 0; e < t.data.length; ++e) r.data[e] = t.data[e];
			n.putImageData(r, 0, 0);
			let i = t.name.slice(-2), a = l[i] ? l[i] : [];
			if (!c) throw Error("Runtime error.");
			c.drawImage(e, a[0], a[1]);
		}
		let u = c.getImageData(0, 0, 512, 1024).data;
		t.bindTexture(t.TEXTURE_2D, i), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, 512, 1024, 0, t.RGBA, t.UNSIGNED_BYTE, new Uint8Array(u)), t.generateMipmap(t.TEXTURE_2D), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.REPEAT), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.REPEAT), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.LINEAR_MIPMAP_LINEAR), t.texParameterf(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR);
		let d = this.context.getAnisotropyExtension();
		d && t.texParameteri(t.TEXTURE_2D, d.TEXTURE_MAX_ANISOTROPY_EXT, this.context.getMaxAnisotropy(d)), this.vertexBuffer = n, this.indexBuffer = r, this.texture = i, this.isReady = !0;
	}
	draw(e) {
		if (!this.isReady) return;
		let t = this.context.gl, n = this.shader;
		n.useProgram(t), t.bindTexture(t.TEXTURE_2D, this.texture), t.bindBuffer(t.ARRAY_BUFFER, this.vertexBuffer), t.bindBuffer(t.ELEMENT_ARRAY_BUFFER, this.indexBuffer), n.enableVertexAttribs(t), n.setVertexAttribPointers(t), n.setDiffuse(t, 0);
		let r = e.position[0], i = e.position[1], a = e.position[2];
		e.position[0] = 0, e.position[1] = 0, e.position[2] = 0, e.updateViewMatrix(), e.position[0] = r, e.position[1] = i, e.position[2] = a, n.setViewMatrix(t, e.viewMatrix), n.setProjectionMatrix(t, e.projectionMatrix), t.drawElements(t.TRIANGLES, 36, t.UNSIGNED_BYTE, 0), t.clear(t.DEPTH_BUFFER_BIT);
	}
}, tt = "#ifdef GL_ES\nprecision highp float;\n#endif\n\nuniform sampler2D diffuse;\nuniform sampler2D lightmap;\nuniform float opacity;\n\nvarying vec2 vTexCoord;\nvarying vec2 vLightmapCoord;\n\nvoid main(void) {\n  vec4 diffuseColor = texture2D(diffuse, vTexCoord);\n  vec4 lightColor = texture2D(lightmap, vLightmapCoord);\n\n  gl_FragColor = vec4(diffuseColor.rgb * lightColor.rgb, diffuseColor.a * opacity);\n}", nt = "#ifdef GL_ES\nprecision highp float;\n#endif\n\nattribute vec3 position;\nattribute vec2 texCoord;\nattribute vec2 texCoord2;\n\nvarying vec2 vTexCoord;\nvarying vec2 vLightmapCoord;\n\nuniform mat4 modelMatrix;\nuniform mat4 viewMatrix;\nuniform mat4 projectionMatrix;\n\nvoid main(void) {\n  vTexCoord = texCoord;\n  vLightmapCoord = texCoord2;\n\n  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1);\n}", rt = class e {
	static init(t) {
		let n = t.createProgram({
			vertexShaderSrc: nt,
			fragmentShaderSrc: tt,
			attributeNames: [
				"position",
				"texCoord",
				"texCoord2"
			],
			uniformNames: [
				"modelMatrix",
				"viewMatrix",
				"projectionMatrix",
				"diffuse",
				"lightmap",
				"opacity"
			]
		});
		return n ? new e(n) : (console.error("Failed to create MainShader program"), null);
	}
	program;
	aPosition;
	aTexCoord;
	aTexCoord2;
	uModelMx;
	uViewMx;
	uProjectionMx;
	uDiffuse;
	uLightmap;
	uOpacity;
	constructor(e) {
		this.program = e.handle, this.aPosition = e.attributes.position, this.aTexCoord = e.attributes.texCoord, this.aTexCoord2 = e.attributes.texCoord2, this.uModelMx = e.uniforms.modelMatrix, this.uViewMx = e.uniforms.viewMatrix, this.uProjectionMx = e.uniforms.projectionMatrix, this.uDiffuse = e.uniforms.diffuse, this.uLightmap = e.uniforms.lightmap, this.uOpacity = e.uniforms.opacity;
	}
	useProgram(e) {
		e.useProgram(this.program);
	}
	setModelMatrix(e, t) {
		e.uniformMatrix4fv(this.uModelMx, !1, t);
	}
	setViewMatrix(e, t) {
		e.uniformMatrix4fv(this.uViewMx, !1, t);
	}
	setProjectionMatrix(e, t) {
		e.uniformMatrix4fv(this.uProjectionMx, !1, t);
	}
	setDiffuse(e, t) {
		e.uniform1i(this.uDiffuse, t);
	}
	setLightmap(e, t) {
		e.uniform1i(this.uLightmap, t);
	}
	setOpacity(e, t) {
		e.uniform1f(this.uOpacity, t);
	}
	enableVertexAttribs(e) {
		e.enableVertexAttribArray(this.aPosition), e.enableVertexAttribArray(this.aTexCoord), e.enableVertexAttribArray(this.aTexCoord2);
	}
	setVertexAttribPointers(e) {
		e.vertexAttribPointer(this.aPosition, 3, e.FLOAT, !1, 28, 0), e.vertexAttribPointer(this.aTexCoord, 2, e.FLOAT, !1, 28, 12), e.vertexAttribPointer(this.aTexCoord2, 2, e.FLOAT, !1, 28, 20);
	}
}, N = /* @__PURE__ */ function(e) {
	return e[e.Normal = 0] = "Normal", e[e.Color = 1] = "Color", e[e.Texture = 2] = "Texture", e[e.Glow = 3] = "Glow", e[e.Solid = 4] = "Solid", e[e.Additive = 5] = "Additive", e;
}({}), it = (e, t, n, r, i) => {
	let a = document.createElement("canvas"), o = a.getContext("2d");
	if (!o) throw Error("Runtime error.");
	a.width = t, a.height = n;
	let s = document.createElement("canvas"), c = s.getContext("2d");
	if (!c) throw Error("Runtime error.");
	s.width = r, s.height = i;
	let l = o.createImageData(t, n);
	for (let r = 0, i = t * n * 4; r < i; r += 4) l.data[r] = e[r], l.data[r + 1] = e[r + 1], l.data[r + 2] = e[r + 2], l.data[r + 3] = e[r + 3];
	return o.putImageData(l, 0, 0), c.drawImage(a, 0, 0, r, i), new Uint8Array(c.getImageData(0, 0, r, i).data);
}, at = (e) => !(e & e - 1), ot = (e) => {
	let t = e;
	--t;
	for (let e = 1; e < 32; e <<= 1) t |= t >> e;
	return t + 1;
}, st = class e {
	static init(t) {
		let n = rt.init(t);
		if (!n) return console.error("Failed to init MainShader"), null;
		n.useProgram(t.gl);
		let r = t.gl.createBuffer();
		return r ? new e({
			buffer: r,
			context: t,
			shader: n
		}) : (console.error("Failed to create WebGL buffer"), null);
	}
	buffer;
	context;
	shader;
	modelMatrix = ge();
	sceneInfo = {
		length: 0,
		data: /* @__PURE__ */ new Float32Array(),
		models: []
	};
	bsp = null;
	textures = [];
	sprites = {};
	lightmap = null;
	constructor(e) {
		this.buffer = e.buffer, this.context = e.context, this.shader = e.shader;
	}
	changeMap(e) {
		this.fillBuffer(e), this.loadTextures(e), this.loadSpriteTextures(e), this.loadLightmap(e), this.bsp = e;
	}
	fillBuffer(e) {
		let t = this.context.gl, n = e.models, r = [
			"aaatrigger",
			"clip",
			"null",
			"hint",
			"nodraw",
			"invisible",
			"skip",
			"trigger",
			"sky",
			"fog"
		], i = 0;
		for (let t = 0; t < n.length; ++t) {
			let a = n[t];
			for (let t = 0; t < a.faces.length; ++t) {
				let n = e.textures[a.faces[t].textureIndex];
				r.indexOf(n.name) > -1 || (i += a.faces[t].buffer.length);
			}
		}
		i += 42;
		let a = {
			length: i,
			data: new Float32Array(i),
			models: []
		}, o = 0;
		for (let t = 0; t < e.models.length; ++t) {
			let n = e.models[t], i = {
				origin: n.origin,
				offset: o,
				length: 0,
				isTransparent: !1,
				faces: []
			};
			for (let t = 0; t < n.faces.length; ++t) {
				let s = e.textures[n.faces[t].textureIndex];
				if (r.indexOf(s.name) > -1) continue;
				let c = {
					offset: o,
					length: 0,
					textureIndex: -1
				};
				for (let e = 0; e < n.faces[t].buffer.length; ++e) a.data[o++] = n.faces[t].buffer[e];
				!i.isTransparent && e.textures[n.faces[t].textureIndex].name[0] === "{" && (i.isTransparent = !0), c.textureIndex = n.faces[t].textureIndex, c.length = o - c.offset, i.faces.push(c);
			}
			i.length = o - i.offset, a.models.push(i);
		}
		a.models.push({
			origin: [
				0,
				0,
				0
			],
			offset: o,
			length: 4,
			isTransparent: !1,
			faces: [{
				offset: o,
				length: 4,
				textureIndex: 0
			}]
		}), a.data[o++] = -.5, a.data[o++] = 0, a.data[o++] = -.5, a.data[o++] = 1, a.data[o++] = 1, a.data[o++] = 0, a.data[o++] = 0, a.data[o++] = .5, a.data[o++] = 0, a.data[o++] = .5, a.data[o++] = 0, a.data[o++] = 0, a.data[o++] = 0, a.data[o++] = 0, a.data[o++] = -.5, a.data[o++] = 0, a.data[o++] = .5, a.data[o++] = 1, a.data[o++] = 0, a.data[o++] = 0, a.data[o++] = 0, a.data[o++] = -.5, a.data[o++] = 0, a.data[o++] = -.5, a.data[o++] = 1, a.data[o++] = 1, a.data[o++] = 0, a.data[o++] = 0, a.data[o++] = .5, a.data[o++] = 0, a.data[o++] = -.5, a.data[o++] = 0, a.data[o++] = 1, a.data[o++] = 0, a.data[o++] = 0, a.data[o++] = .5, a.data[o++] = 0, a.data[o++] = .5, a.data[o++] = 0, a.data[o++] = 0, a.data[o++] = 0, a.data[o++] = 0, o = 0;
		let s = {
			data: new Float32Array(a.data),
			length: a.length,
			models: a.models.map((e) => ({
				origin: Te(e.origin),
				offset: e.offset,
				length: e.length,
				isTransparent: e.isTransparent,
				faces: e.faces.map((e) => ({
					offset: e.offset,
					length: e.length,
					textureIndex: e.textureIndex
				}))
			}))
		};
		for (let e = 0; e < s.models.length; ++e) {
			let t = s.models[e];
			t.faces.sort((e, t) => e.textureIndex - t.textureIndex);
			for (let e = 0; e < t.faces.length; ++e) {
				let n = t.faces[e], r = o;
				for (let e = 0; e < n.length; ++e) s.data[o] = a.data[n.offset + e], o += 1;
				n.offset = r;
			}
			let n = [], r = -1;
			for (let e = 0; e < t.faces.length; ++e) {
				let i = t.faces[e];
				i.textureIndex === r ? n[n.length - 1].length += i.length : (n.push({
					offset: i.offset,
					length: i.length,
					textureIndex: i.textureIndex
				}), r = i.textureIndex);
			}
			t.faces = n;
		}
		this.sceneInfo = s, t.bindBuffer(t.ARRAY_BUFFER, this.buffer), t.bufferData(t.ARRAY_BUFFER, this.sceneInfo.data, t.STATIC_DRAW);
	}
	loadTextures(e) {
		let t = this.context.gl;
		for (let n = 0; n < e.textures.length; ++n) {
			let r = t.createTexture();
			if (!r) throw Error("fatal error");
			let i = e.textures[n];
			if (!at(i.width) || !at(i.height)) {
				let e = i.width, t = i.height, n = ot(i.width), r = ot(i.height);
				i.data = it(i.data, e, t, n, r), i.width = n, i.height = r;
			}
			t.bindTexture(t.TEXTURE_2D, r), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, i.width, i.height, 0, t.RGBA, t.UNSIGNED_BYTE, i.data), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.LINEAR_MIPMAP_LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.REPEAT), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.REPEAT), t.generateMipmap(t.TEXTURE_2D);
			let a = this.context.getAnisotropyExtension();
			a && t.texParameteri(t.TEXTURE_2D, a.TEXTURE_MAX_ANISOTROPY_EXT, this.context.getMaxAnisotropy(a)), this.textures.push({
				name: i.name,
				width: i.width,
				height: i.height,
				data: i.data,
				handle: r
			});
		}
	}
	loadSpriteTextures(e) {
		let t = this.context.gl;
		for (let [n, r] of Object.entries(e.sprites)) {
			let e = t.createTexture();
			if (!e) throw Error("fatal error");
			let i = r.frames[0];
			if (!at(i.width) || !at(i.height)) {
				let e = i.width, t = i.height, n = ot(i.width), r = ot(i.height);
				i.data = it(i.data, e, t, n, r), i.width = n, i.height = r;
			}
			t.bindTexture(t.TEXTURE_2D, e), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, i.width, i.height, 0, t.RGBA, t.UNSIGNED_BYTE, i.data), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.LINEAR_MIPMAP_LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.REPEAT), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.REPEAT), t.generateMipmap(t.TEXTURE_2D);
			let a = this.context.getAnisotropyExtension();
			a && t.texParameteri(t.TEXTURE_2D, a.TEXTURE_MAX_ANISOTROPY_EXT, this.context.getMaxAnisotropy(a)), this.textures.push({
				name: n,
				width: i.width,
				height: i.height,
				data: i.data,
				handle: e
			}), this.sprites[n] = r;
		}
	}
	loadLightmap(e) {
		let t = this.context.gl, n = t.createTexture();
		if (!n) throw Error("fatal error");
		t.bindTexture(t.TEXTURE_2D, n), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, e.lightmap.width, e.lightmap.height, 0, t.RGBA, t.UNSIGNED_BYTE, e.lightmap.data), t.generateMipmap(t.TEXTURE_2D), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.LINEAR_MIPMAP_LINEAR), this.lightmap = {
			data: e.lightmap.data,
			handle: n
		};
	}
	draw(e, t) {
		if (!this.bsp || !this.lightmap) return;
		let n = this.context.gl, r = this.shader;
		r.useProgram(n), e.updateProjectionMatrix(), e.updateViewMatrix(), r.setViewMatrix(n, e.viewMatrix), r.setProjectionMatrix(n, e.projectionMatrix), n.bindBuffer(n.ARRAY_BUFFER, this.buffer), r.enableVertexAttribs(n), r.setVertexAttribPointers(n), r.setDiffuse(n, 0), r.setLightmap(n, 1), n.activeTexture(n.TEXTURE1), n.bindTexture(n.TEXTURE_2D, this.lightmap.handle), n.activeTexture(n.TEXTURE0);
		let i = [], a = [];
		for (let e = 1; e < t.length; ++e) {
			let n = t[e];
			if (n.model) {
				if (!n.rendermode || n.rendermode === N.Normal || n.rendermode === N.Solid) {
					if (n.model[0] === "*") {
						if (this.sceneInfo.models[Number.parseInt(n.model.substr(1))].isTransparent) {
							a.push(n);
							continue;
						}
					} else if (n.model.indexOf(".spr") > -1) {
						a.push(n);
						continue;
					}
					i.push(n);
				} else n.rendermode, N.Additive, a.push(n);
			}
		}
		r.setOpacity(n, 1), this.renderWorldSpawn(), this.renderOpaqueEntities(e, i), a.length && (n.depthMask(!1), this.renderTransparentEntities(a, e), n.depthMask(!0));
	}
	renderWorldSpawn() {
		let e = this.sceneInfo.models[0], t = this.context.gl;
		_e(this.modelMatrix), this.shader.setModelMatrix(t, this.modelMatrix);
		for (let n = 0; n < e.faces.length; ++n) {
			let r = e.faces[n];
			t.bindTexture(t.TEXTURE_2D, this.textures[r.textureIndex].handle), t.drawArrays(t.TRIANGLES, r.offset / 7, r.length / 7);
		}
	}
	renderOpaqueEntities(e, t) {
		let n = this.context.gl, r = this.shader, i = this.modelMatrix;
		for (let a = 0; a < t.length; ++a) {
			let o = t[a], s = Number.parseInt(o.model.substr(1)), c = this.sceneInfo.models[s];
			if (c) {
				let e = o.angles || [
					0,
					0,
					0
				], t = o.origin ? j(o.origin[0], o.origin[1], o.origin[2]) : we();
				Ee(t, t, c.origin), _e(i), ve(i, i, t), A(i, i, e[1] * Math.PI / 180), be(this.modelMatrix, this.modelMatrix, e[2] * Math.PI / 180), r.setModelMatrix(n, this.modelMatrix);
				for (let e = 0; e < c.faces.length; ++e) {
					let t = c.faces[e];
					n.bindTexture(n.TEXTURE_2D, this.textures[t.textureIndex].handle), n.drawArrays(n.TRIANGLES, t.offset / 7, t.length / 7);
				}
			} else if (o.model.indexOf(".spr") > -1) {
				let t = this.textures.find((e) => e.name === o.model), a = this.sprites[o.model];
				if (t && a) {
					let s = o.origin ? j(o.origin[0], o.origin[1], o.origin[2]) : we(), c = j(t.width, 1, t.height), l = o.angles ? j(o.angles[0], o.angles[2], o.angles[1]) : we();
					switch (De(c, c, o.scale || 1), _e(i), ve(i, i, s), a.header.type) {
						case O.VP_PARALLEL_UPRIGHT:
							A(i, i, e.rotation[1] + Math.PI / 2);
							break;
						case O.FACING_UPRIGHT:
							A(i, i, e.rotation[1] + Math.PI / 2);
							break;
						case O.VP_PARALLEL:
							A(i, i, Math.atan2(s[1] - e.position[1], s[0] - e.position[0]) + Math.PI / 2), be(i, i, Math.atan2(e.position[2] - s[2], Math.sqrt((e.position[0] - s[0]) ** 2 + (e.position[1] - s[1]) ** 2)));
							break;
						case O.ORIENTED:
							xe(i, i, l[0] * Math.PI / 180 + Math.PI), A(i, i, l[1] * Math.PI / 180 + Math.PI), be(i, i, l[2] * Math.PI / 180 - Math.PI / 2);
							break;
						case O.VP_PARALLEL_ORIENTED:
							xe(i, i, l[0] * Math.PI / 180 + Math.PI), A(i, i, l[1] * Math.PI / 180 + Math.PI);
							break;
						default: throw Error("Invalid sprite type");
					}
					switch (ye(i, i, c), r.setModelMatrix(n, i), r.setOpacity(n, (o.renderamt || 255) / 255), o.rendermode || N.Normal) {
						case N.Normal:
							r.setOpacity(n, 1), n.bindTexture(n.TEXTURE_2D, t.handle), n.drawArrays(n.TRIANGLES, this.sceneInfo.models[this.sceneInfo.models.length - 1].offset / 7, 6);
							break;
						case N.Color:
							r.setOpacity(n, (o.renderamt || 255) / 255), n.bindTexture(n.TEXTURE_2D, t.handle), n.drawArrays(n.TRIANGLES, this.sceneInfo.models[this.sceneInfo.models.length - 1].offset / 7, 6);
							break;
						case N.Texture:
							r.setOpacity(n, (o.renderamt || 255) / 255), n.bindTexture(n.TEXTURE_2D, t.handle), n.drawArrays(n.TRIANGLES, this.sceneInfo.models[this.sceneInfo.models.length - 1].offset / 7, 6);
							break;
						case N.Glow:
							n.blendFunc(n.SRC_ALPHA, n.DST_ALPHA), r.setOpacity(n, (o.renderamt || 255) / 255), n.bindTexture(n.TEXTURE_2D, t.handle), n.drawArrays(n.TRIANGLES, this.sceneInfo.models[this.sceneInfo.models.length - 1].offset / 7, 6), n.blendFunc(n.SRC_ALPHA, n.ONE_MINUS_SRC_ALPHA);
							break;
						case N.Solid:
							r.setOpacity(n, (o.renderamt || 255) / 255), n.bindTexture(n.TEXTURE_2D, t.handle), n.drawArrays(n.TRIANGLES, this.sceneInfo.models[this.sceneInfo.models.length - 1].offset / 7, 6);
							break;
						case N.Additive: n.blendFunc(n.SRC_ALPHA, n.DST_ALPHA), r.setOpacity(n, (o.renderamt || 255) / 255), n.bindTexture(n.TEXTURE_2D, t.handle), n.drawArrays(n.TRIANGLES, this.sceneInfo.models[this.sceneInfo.models.length - 1].offset / 7, 6), n.blendFunc(n.SRC_ALPHA, n.ONE_MINUS_SRC_ALPHA);
					}
				}
			}
		}
	}
	renderTransparentEntities(e, t) {
		let n = this.context.gl, r = this.shader, i = this.modelMatrix, a = e.map((e, n) => ({
			index: n,
			distance: ke(t.position, e.origin || [
				0,
				0,
				0
			])
		})).sort((e, t) => e.distance - t.distance);
		for (let o = 0; o < a.length; ++o) {
			let s = e[a[o].index], c = Number.parseInt(s.model.substr(1)), l = this.sceneInfo.models[c];
			if (l) {
				let e = s.angles || [
					0,
					0,
					0
				], t = s.origin || [
					0,
					0,
					0
				];
				switch (t[0] += l.origin[0], t[1] += l.origin[1], t[2] += l.origin[2], _e(i), ve(i, i, t), A(i, i, e[1] * Math.PI / 180), be(this.modelMatrix, this.modelMatrix, e[2] * Math.PI / 180), r.setModelMatrix(n, this.modelMatrix), s.rendermode || N.Normal) {
					case N.Normal:
						r.setOpacity(n, 1);
						for (let e = 0; e < l.faces.length; ++e) {
							let t = l.faces[e];
							n.bindTexture(n.TEXTURE_2D, this.textures[t.textureIndex].handle), n.drawArrays(n.TRIANGLES, t.offset / 7, t.length / 7);
						}
						break;
					case N.Color:
						r.setOpacity(n, (s.renderamt || 255) / 255);
						for (let e = 0; e < l.faces.length; ++e) {
							let t = l.faces[e];
							n.bindTexture(n.TEXTURE_2D, this.textures[t.textureIndex].handle), n.drawArrays(n.TRIANGLES, t.offset / 7, t.length / 7);
						}
						break;
					case N.Texture:
						r.setOpacity(n, (s.renderamt || 255) / 255);
						for (let e = 0; e < l.faces.length; ++e) {
							let t = l.faces[e];
							n.bindTexture(n.TEXTURE_2D, this.textures[t.textureIndex].handle), n.drawArrays(n.TRIANGLES, t.offset / 7, t.length / 7);
						}
						break;
					case N.Glow:
						r.setOpacity(n, (s.renderamt || 255) / 255);
						for (let e = 0; e < l.faces.length; ++e) {
							let t = l.faces[e];
							n.bindTexture(n.TEXTURE_2D, this.textures[t.textureIndex].handle), n.drawArrays(n.TRIANGLES, t.offset / 7, t.length / 7);
						}
						break;
					case N.Solid:
						r.setOpacity(n, (s.renderamt || 255) / 255);
						for (let e = 0; e < l.faces.length; ++e) {
							let t = l.faces[e];
							n.bindTexture(n.TEXTURE_2D, this.textures[t.textureIndex].handle), n.drawArrays(n.TRIANGLES, t.offset / 7, t.length / 7);
						}
						break;
					case N.Additive:
						n.blendFunc(n.SRC_ALPHA, n.DST_ALPHA), r.setOpacity(n, (s.renderamt || 255) / 255);
						for (let e = 0; e < l.faces.length; ++e) {
							let t = l.faces[e];
							n.bindTexture(n.TEXTURE_2D, this.textures[t.textureIndex].handle), n.drawArrays(n.TRIANGLES, t.offset / 7, t.length / 7);
						}
						n.blendFunc(n.SRC_ALPHA, n.ONE_MINUS_SRC_ALPHA);
				}
			} else if (s.model.indexOf(".spr") > -1) {
				let e = this.textures.find((e) => e.name === s.model), a = this.sprites[s.model];
				if (e && a) {
					let o = s.origin ? j(s.origin[0], s.origin[1], s.origin[2]) : we(), c = j(e.width, 1, e.height), l = s.angles ? j(s.angles[0], s.angles[2], s.angles[1]) : we();
					switch (De(c, c, s.scale || 1), _e(i), ve(i, i, o), a.header.type) {
						case O.VP_PARALLEL_UPRIGHT:
							A(i, i, t.rotation[1] + Math.PI / 2);
							break;
						case O.FACING_UPRIGHT:
							A(i, i, t.rotation[1] + Math.PI / 2);
							break;
						case O.VP_PARALLEL:
							A(i, i, Math.atan2(o[1] - t.position[1], o[0] - t.position[0]) + Math.PI / 2), be(i, i, Math.atan2(t.position[2] - o[2], Math.sqrt((t.position[0] - o[0]) ** 2 + (t.position[1] - o[1]) ** 2)));
							break;
						case O.ORIENTED:
							xe(i, i, l[0] * Math.PI / 180 + Math.PI), A(i, i, l[1] * Math.PI / 180 + Math.PI), be(i, i, l[2] * Math.PI / 180 - Math.PI / 2);
							break;
						case O.VP_PARALLEL_ORIENTED:
							xe(i, i, l[0] * Math.PI / 180 + Math.PI), A(i, i, l[1] * Math.PI / 180 + Math.PI);
							break;
						default: throw Error("Invalid sprite type");
					}
					switch (ye(i, i, c), r.setModelMatrix(n, i), r.setOpacity(n, (s.renderamt || 255) / 255), s.rendermode || N.Normal) {
						case N.Normal:
							r.setOpacity(n, 1), n.bindTexture(n.TEXTURE_2D, e.handle), n.drawArrays(n.TRIANGLES, this.sceneInfo.models[this.sceneInfo.models.length - 1].offset / 7, 6);
							break;
						case N.Color:
							r.setOpacity(n, (s.renderamt || 255) / 255), n.bindTexture(n.TEXTURE_2D, e.handle), n.drawArrays(n.TRIANGLES, this.sceneInfo.models[this.sceneInfo.models.length - 1].offset / 7, 6);
							break;
						case N.Texture:
							r.setOpacity(n, (s.renderamt || 255) / 255), n.bindTexture(n.TEXTURE_2D, e.handle), n.drawArrays(n.TRIANGLES, this.sceneInfo.models[this.sceneInfo.models.length - 1].offset / 7, 6);
							break;
						case N.Glow:
							n.blendFunc(n.SRC_ALPHA, n.DST_ALPHA), r.setOpacity(n, (s.renderamt || 255) / 255), n.bindTexture(n.TEXTURE_2D, e.handle), n.drawArrays(n.TRIANGLES, this.sceneInfo.models[this.sceneInfo.models.length - 1].offset / 7, 6), n.blendFunc(n.SRC_ALPHA, n.ONE_MINUS_SRC_ALPHA);
							break;
						case N.Solid:
							r.setOpacity(n, (s.renderamt || 255) / 255), n.bindTexture(n.TEXTURE_2D, e.handle), n.drawArrays(n.TRIANGLES, this.sceneInfo.models[this.sceneInfo.models.length - 1].offset / 7, 6);
							break;
						case N.Additive: n.blendFunc(n.SRC_ALPHA, n.DST_ALPHA), r.setOpacity(n, (s.renderamt || 255) / 255), n.bindTexture(n.TEXTURE_2D, e.handle), n.drawArrays(n.TRIANGLES, this.sceneInfo.models[this.sceneInfo.models.length - 1].offset / 7, 6), n.blendFunc(n.SRC_ALPHA, n.ONE_MINUS_SRC_ALPHA);
					}
				}
			}
		}
	}
}, P = /* @__PURE__ */ function(e) {
	return e[e.FREE = 0] = "FREE", e[e.REPLAY = 1] = "REPLAY", e;
}({}), ct = class n {
	static init(e) {
		if (!qe.checkWebGLSupport().hasSupport) return {
			status: "error",
			message: "No WebGL support!"
		};
		let t = document.createElement("canvas");
		if (!t) return {
			status: "error",
			message: "Failed to create <canvas> element!"
		};
		let r = qe.init(t);
		if (!r) return {
			status: "error",
			message: "Failed to initialize WebGL context"
		};
		let i = Xe.init(r);
		if (!i) return {
			status: "error",
			message: "Failed to initialize renderer"
		};
		let a = st.init(r);
		if (!a) return {
			status: "error",
			message: "Failed to initialize world scene"
		};
		let o = et.init(r);
		return o ? {
			status: "success",
			game: new n({
				canvas: t,
				config: e,
				context: r,
				renderer: i,
				worldScene: a,
				skyScene: o
			})
		} : {
			status: "error",
			message: "Failed to initialize sky scene"
		};
	}
	config;
	pauseTime = 0;
	isPaused = !1;
	lastTime = 0;
	accumTime = 0;
	timeStep = 1 / 60;
	title = "";
	mode;
	pointerLocked = !1;
	touch = new Ge();
	mouse = new We();
	keyboard = new M();
	loader;
	entities = [];
	sounds;
	soundSystem;
	events;
	player;
	canvas;
	mapName;
	context;
	camera;
	renderer;
	worldScene;
	skyScene;
	constructor(t) {
		this.sounds = [], this.soundSystem = new i(), this.config = t.config, this.loader = new Ue(this.config), this.loader.events.on("loadall", this.onLoadAll), document.addEventListener("touchstart", this.onTouchStart, !1), document.addEventListener("touchend", this.onTouchEnd, !1), document.addEventListener("touchcancel", this.onTouchEnd, !1), document.addEventListener("touchmove", this.onTouchMove, !1), document.addEventListener("mousemove", this.onMouseMove, !1), window.addEventListener("keydown", this.keyDown), window.addEventListener("keyup", this.keyUp), window.addEventListener("visibilitychange", this.onVisibilityChange), this.canvas = t.canvas, this.camera = Ke.init(this.canvas.width / this.canvas.height), this.context = t.context, this.renderer = t.renderer, this.worldScene = t.worldScene, this.skyScene = t.skyScene, this.mode = 0, this.player = new Ye(this), this.events = e(), this.mapName = "";
	}
	getCanvas() {
		return this.canvas;
	}
	load(e) {
		this.events.emit("loadstart"), this.loader.load(e);
	}
	changeMap(e) {
		if (this.mapName.toLowerCase() === e.name.toLowerCase()) return;
		this.mapName = e.name, this.worldScene.changeMap(e), this.skyScene.changeMap(e), this.entities = e.entities;
		let t = e.entities.find((e) => e.classname === "info_player_start");
		t ? (this.camera.position[0] = t.origin[0], this.camera.position[1] = t.origin[1], this.camera.position[2] = t.origin[2]) : (this.camera.position[0] = 0, this.camera.position[1] = 0, this.camera.position[2] = 0), this.camera.rotation[0] = 0, this.camera.rotation[1] = 0, this.camera.rotation[2] = 0;
	}
	changeReplay(e) {
		this.events.emit("prereplaychange", this, e), this.player.changeReplay(e), this.events.emit("postreplaychange", this, e);
	}
	changeMode(e) {
		this.mode = e, this.events.emit("modechange", e);
	}
	setTitle(e) {
		this.title = e, this.events.emit("titlechange", e);
	}
	getTitle() {
		return this.title;
	}
	onLoadAll = (e) => {
		if (e?.replay && (this.changeReplay(e.replay.data), this.changeMode(1)), !e.map || !e.map.data) return;
		let t = e.map.data, n = e.skies, r = !0;
		for (let e of n) r &&= e.isDone();
		if (r) for (let e of n) e.data && t.skies.push(e.data);
		for (let [n, r] of Object.entries(e.sprites)) r.data && (t.sprites[n] = r.data);
		if (e.sounds.length > 0) for (let t of e.sounds) t.data && this.sounds.push(t.data);
		this.changeMap(t), this.events.emit("load", e);
	};
	draw = () => {
		requestAnimationFrame(this.draw);
		let e = this.canvas, n = e.parentElement;
		if (n) {
			let t = n.clientWidth, r = n.clientHeight;
			(e.width !== t || e.height !== r) && (e.width = t, e.height = r, this.camera.aspect = e.clientWidth / e.clientHeight, this.camera.updateProjectionMatrix(), this.context.gl.viewport(0, 0, this.context.gl.drawingBufferWidth, this.context.gl.drawingBufferHeight)), (e.clientWidth !== e.width || e.clientHeight !== e.height) && (e.width = e.clientWidth, e.height = e.clientHeight, this.camera.aspect = e.clientWidth / e.clientHeight, this.camera.updateProjectionMatrix(), this.context.gl.viewport(0, 0, this.context.gl.drawingBufferWidth, this.context.gl.drawingBufferHeight));
		}
		if (this.isPaused) return;
		let r = t() / 1e3, i = r - this.lastTime;
		for (this.accumTime += i; this.accumTime > this.timeStep;) this.update(this.timeStep), this.accumTime -= this.timeStep;
		this.renderer.draw(), this.mapName !== "" && (this.skyScene.draw(this.camera), this.worldScene.draw(this.camera, this.entities)), this.lastTime = r;
	};
	update(e) {
		this.events.emit("preupdate", this);
		let t = this.camera, n = this.keyboard, r = this.mouse, i = this.touch;
		if (this.mode === 1) this.player.update(e);
		else if (this.mode === 0) {
			this.touch.pressed ? (t.rotation[0] = Math.min(Math.max(t.rotation[0] + i.delta[1] / 100, -Math.PI / 2), Math.PI / 2), t.rotation[1] -= i.delta[0] / 100) : (t.rotation[0] = Math.min(Math.max(t.rotation[0] + r.delta[1] / 100, -Math.PI / 2), Math.PI / 2), t.rotation[1] -= r.delta[0] / 100);
			let a = 500 * e, o = M.KEYS.W, s = M.KEYS.S, c = M.KEYS.A, l = M.KEYS.D, u = M.KEYS.C, d = M.KEYS.SPACE;
			if (n.keys[o] !== n.keys[s]) {
				let e = t.rotation[1], r = t.rotation[0];
				n.keys[o] ? (t.position[0] += Math.cos(e) * Math.cos(r) * a, t.position[1] += Math.sin(e) * Math.cos(r) * a, t.position[2] -= Math.sin(r) * a) : n.keys[s] && (t.position[0] -= Math.cos(e) * Math.cos(r) * a, t.position[1] -= Math.sin(e) * Math.cos(r) * a, t.position[2] += Math.sin(r) * a);
			}
			n.keys[c] !== n.keys[l] && (n.keys[c] ? (t.position[1] += Math.cos(t.rotation[1]) * a, t.position[0] -= Math.sin(t.rotation[1]) * a) : n.keys[l] && (t.position[1] -= Math.cos(t.rotation[1]) * a, t.position[0] += Math.sin(t.rotation[1]) * a)), n.keys[d] !== n.keys[u] && (n.keys[d] ? t.position[2] += a : n.keys[u] && (t.position[2] -= a));
		}
		r.delta[0] = 0, r.delta[1] = 0, this.events.emit("postupdate", this);
	}
	onTouchStart = (e) => {
		let t = e.touches.item(0);
		t && (this.touch.pressed = !0, this.touch.position[0] = t.clientX, this.touch.position[1] = t.clientY);
	};
	onTouchEnd = () => {
		this.touch.pressed = !1, this.touch.delta[0] = 0, this.touch.delta[1] = 0;
	};
	onTouchMove = (e) => {
		let t = e.touches.item(0);
		t && this.touch.pressed && (this.touch.delta[0], this.touch.delta[0] = t.clientX - this.touch.position[0], this.touch.delta[1] = t.clientY - this.touch.position[1], this.touch.position[0] = t.clientX, this.touch.position[1] = t.clientY);
	};
	onMouseMove = (e) => {
		this.pointerLocked && (this.mouse.delta[0] = e.movementX * .5, this.mouse.delta[1] = e.movementY * .5, this.mouse.position[0] = e.pageX, this.mouse.position[1] = e.pageY);
	};
	keyDown = (e) => (this.keyboard.keys[e.which] = 1, !this.pointerLocked || (e.preventDefault(), !1));
	keyUp = (e) => (this.keyboard.keys[e.which] = 0, !this.pointerLocked || (e.preventDefault(), !1));
	onVisibilityChange = () => {
		if (document.hidden) {
			if (this.isPaused) return;
			this.pauseTime = t() / 1e3, this.isPaused = !0;
		} else {
			if (!this.isPaused) return;
			this.lastTime = t() / 1e3 - this.pauseTime + this.lastTime, this.isPaused = !1;
		}
	};
}, lt = class e {
	static init(t) {
		return typeof t == "string" ? new e({ paths: {
			base: t,
			replays: `${t}/replays`,
			maps: `${t}/maps`,
			wads: `${t}/wads`,
			skies: `${t}/skies`,
			sounds: `${t}/sounds`
		} }) : new e({ paths: {
			base: t?.paths?.base || "",
			replays: t?.paths?.replays || "/replays",
			maps: t?.paths?.maps || "/maps",
			wads: t?.paths?.wads || "/wads",
			skies: t?.paths?.skies || "/skies",
			sounds: t?.paths?.sounds || "/sounds"
		} });
	}
	paths;
	constructor(e) {
		this.paths = { ...e.paths };
	}
	getBasePath() {
		return this.paths.base;
	}
	getReplaysPath() {
		return this.paths.replays;
	}
	getMapsPath() {
		return this.paths.maps;
	}
	getWadsPath() {
		return this.paths.wads;
	}
	getSkiesPath() {
		return this.paths.skies;
	}
	getSoundsPath() {
		return this.paths.sounds;
	}
}, F = {
	context: void 0,
	registry: void 0,
	effects: void 0,
	done: !1,
	getContextId() {
		return ut(this.context.count);
	},
	getNextContextId() {
		return ut(this.context.count++);
	}
};
function ut(e) {
	let t = String(e), n = t.length - 1;
	return F.context.id + (n ? String.fromCharCode(96 + n) : "") + t;
}
function dt(e) {
	F.context = e;
}
var ft = (e, t) => e === t, pt = Symbol("solid-proxy"), mt = Symbol("solid-track"), ht = { equals: ft }, gt = null, _t = Vt, I = 1, vt = 2, yt = {
	owned: null,
	cleanups: null,
	context: null,
	owner: null
}, L = null, R = null, z = null, B = null, V = null, bt = 0;
function xt(e, t) {
	let n = z, r = L, i = e.length === 0, a = t === void 0 ? r : t, o = i ? yt : {
		owned: null,
		cleanups: null,
		context: a ? a.context : null,
		owner: a
	}, s = i ? e : () => e(() => W(() => K(o)));
	L = o, z = null;
	try {
		return G(s, !0);
	} finally {
		z = n, L = r;
	}
}
function H(e, t) {
	t = t ? Object.assign({}, ht, t) : ht;
	let n = {
		value: e,
		observers: null,
		observerSlots: null,
		comparator: t.equals || void 0
	};
	return [Pt.bind(n), (e) => (typeof e == "function" && (e = R && R.running && R.sources.has(n) ? e(n.tValue) : e(n.value)), Ft(n, e))];
}
function U(e, t, n) {
	It(Rt(e, t, !1, I));
}
function St(e, t, n) {
	_t = Ht;
	let r = Rt(e, t, !1, I), i = Nt && jt(Nt);
	i && (r.suspense = i), (!n || !n.render) && (r.user = !0), V ? V.push(r) : It(r);
}
function Ct(e, t, n) {
	n = n ? Object.assign({}, ht, n) : ht;
	let r = Rt(e, t, !0, 0);
	return r.observers = null, r.observerSlots = null, r.comparator = n.equals || void 0, It(r), Pt.bind(r);
}
function wt(e) {
	return G(e, !1);
}
function W(e) {
	if (z === null) return e();
	let t = z;
	z = null;
	try {
		return e();
	} finally {
		z = t;
	}
}
function Tt(e) {
	St(() => W(e));
}
function Et(e) {
	return L === null || (L.cleanups === null ? L.cleanups = [e] : L.cleanups.push(e)), e;
}
function Dt() {
	return z;
}
var [Ot, kt] = /*@__PURE__*/ H(!1);
function At(e, t) {
	let n = Symbol("context");
	return {
		id: n,
		Provider: Xt(n),
		defaultValue: e
	};
}
function jt(e) {
	let t;
	return L && L.context && (t = L.context[e.id]) !== void 0 ? t : e.defaultValue;
}
function Mt(e) {
	let t = Ct(e), n = Ct(() => Yt(t()));
	return n.toArray = () => {
		let e = n();
		return Array.isArray(e) ? e : e == null ? [] : [e];
	}, n;
}
var Nt;
function Pt() {
	let e = R && R.running;
	if (this.sources && (e ? this.tState : this.state)) {
		if ((e ? this.tState : this.state) === I) It(this);
		else {
			let e = B;
			B = null, G(() => Ut(this), !1), B = e;
		}
	}
	if (z) {
		let e = this.observers;
		if (!e || e[e.length - 1] !== z) {
			let t = e ? e.length : 0;
			z.sources ? (z.sources.push(this), z.sourceSlots.push(t)) : (z.sources = [this], z.sourceSlots = [t]), e ? (e.push(z), this.observerSlots.push(z.sources.length - 1)) : (this.observers = [z], this.observerSlots = [z.sources.length - 1]);
		}
	}
	return e && R.sources.has(this) ? this.tValue : this.value;
}
function Ft(e, t, n) {
	let r = R && R.running && R.sources.has(e) ? e.tValue : e.value;
	if (!e.comparator || !e.comparator(r, t)) {
		if (R) {
			let r = R.running;
			(r || !n && R.sources.has(e)) && (R.sources.add(e), e.tValue = t), r || (e.value = t);
		} else e.value = t;
		e.observers && e.observers.length && G(() => {
			for (let t = 0; t < e.observers.length; t += 1) {
				let n = e.observers[t], r = R && R.running;
				r && R.disposed.has(n) || ((r ? !n.tState : !n.state) && (n.pure ? B.push(n) : V.push(n), n.observers && Wt(n)), r ? n.tState = I : n.state = I);
			}
			if (B.length > 1e6) throw B = [], Error();
		}, !1);
	}
	return t;
}
function It(e) {
	if (!e.fn) return;
	K(e);
	let t = bt;
	Lt(e, R && R.running && R.sources.has(e) ? e.tValue : e.value, t), R && !R.running && R.sources.has(e) && queueMicrotask(() => {
		G(() => {
			R && (R.running = !0), z = L = e, Lt(e, e.tValue, t), z = L = null;
		}, !1);
	});
}
function Lt(e, t, n) {
	let r, i = L, a = z;
	z = L = e;
	try {
		r = e.fn(t);
	} catch (t) {
		return e.pure && (R && R.running ? (e.tState = I, e.tOwned && e.tOwned.forEach(K), e.tOwned = void 0) : (e.state = I, e.owned && e.owned.forEach(K), e.owned = null)), e.updatedAt = n + 1, Jt(t);
	} finally {
		z = a, L = i;
	}
	(!e.updatedAt || e.updatedAt <= n) && (e.updatedAt != null && "observers" in e ? Ft(e, r, !0) : R && R.running && e.pure ? (R.sources.has(e) || (e.value = r), R.sources.add(e), e.tValue = r) : e.value = r, e.updatedAt = n);
}
function Rt(e, t, n, r = I, i) {
	let a = {
		fn: e,
		state: r,
		updatedAt: null,
		owned: null,
		sources: null,
		sourceSlots: null,
		cleanups: null,
		value: t,
		owner: L,
		context: L ? L.context : null,
		pure: n
	};
	return R && R.running && (a.state = 0, a.tState = r), L === null || L !== yt && (R && R.running && L.pure ? L.tOwned ? L.tOwned.push(a) : L.tOwned = [a] : L.owned ? L.owned.push(a) : L.owned = [a]), a;
}
function zt(e) {
	let t = R && R.running;
	if ((t ? e.tState : e.state) === 0) return;
	if ((t ? e.tState : e.state) === vt) return Ut(e);
	if (e.suspense && W(e.suspense.inFallback)) return e.suspense.effects.push(e);
	let n = [e];
	for (; (e = e.owner) && (!e.updatedAt || e.updatedAt < bt);) {
		if (t && R.disposed.has(e)) return;
		(t ? e.tState : e.state) && n.push(e);
	}
	for (let r = n.length - 1; r >= 0; r--) {
		if (e = n[r], t) {
			let t = e, i = n[r + 1];
			for (; (t = t.owner) && t !== i;) if (R.disposed.has(t)) return;
		}
		if ((t ? e.tState : e.state) === I) It(e);
		else if ((t ? e.tState : e.state) === vt) {
			let t = B;
			B = null, G(() => Ut(e, n[0]), !1), B = t;
		}
	}
}
function G(e, t) {
	if (B) return e();
	let n = !1;
	t || (B = []), V ? n = !0 : V = [], bt++;
	try {
		let t = e();
		return Bt(n), t;
	} catch (e) {
		n || (V = null), B = null, Jt(e);
	}
}
function Bt(e) {
	if (B &&= (Vt(B), null), e) return;
	let t;
	if (R) {
		if (!R.promises.size && !R.queue.size) {
			let e = R.sources, n = R.disposed;
			V.push.apply(V, R.effects), t = R.resolve;
			for (let e of V) "tState" in e && (e.state = e.tState), delete e.tState;
			R = null, G(() => {
				for (let e of n) K(e);
				for (let t of e) {
					if (t.value = t.tValue, t.owned) for (let e = 0, n = t.owned.length; e < n; e++) K(t.owned[e]);
					t.tOwned && (t.owned = t.tOwned), delete t.tValue, delete t.tOwned, t.tState = 0;
				}
				kt(!1);
			}, !1);
		} else if (R.running) {
			R.running = !1, R.effects.push.apply(R.effects, V), V = null, kt(!0);
			return;
		}
	}
	let n = V;
	V = null, n.length && G(() => _t(n), !1), t && t();
}
function Vt(e) {
	for (let t = 0; t < e.length; t++) zt(e[t]);
}
function Ht(e) {
	let t, n = 0;
	for (t = 0; t < e.length; t++) {
		let r = e[t];
		r.user ? e[n++] = r : zt(r);
	}
	if (F.context) {
		if (F.count) {
			F.effects ||= [], F.effects.push(...e.slice(0, n));
			return;
		}
		dt();
	}
	for (F.effects && (F.done || !F.count) && (e = [...F.effects, ...e], n += F.effects.length, delete F.effects), t = 0; t < n; t++) zt(e[t]);
}
function Ut(e, t) {
	let n = R && R.running;
	n ? e.tState = 0 : e.state = 0;
	for (let r = 0; r < e.sources.length; r += 1) {
		let i = e.sources[r];
		if (i.sources) {
			let e = n ? i.tState : i.state;
			e === I ? i !== t && (!i.updatedAt || i.updatedAt < bt) && zt(i) : e === vt && Ut(i, t);
		}
	}
}
function Wt(e) {
	let t = R && R.running;
	for (let n = 0; n < e.observers.length; n += 1) {
		let r = e.observers[n];
		(t ? !r.tState : !r.state) && (t ? r.tState = vt : r.state = vt, r.pure ? B.push(r) : V.push(r), r.observers && Wt(r));
	}
}
function K(e) {
	let t;
	if (e.sources) for (; e.sources.length;) {
		let t = e.sources.pop(), n = e.sourceSlots.pop(), r = t.observers;
		if (r && r.length) {
			let e = r.pop(), i = t.observerSlots.pop();
			n < r.length && (e.sourceSlots[i] = n, r[n] = e, t.observerSlots[n] = i);
		}
	}
	if (e.tOwned) {
		for (t = e.tOwned.length - 1; t >= 0; t--) K(e.tOwned[t]);
		delete e.tOwned;
	}
	if (R && R.running && e.pure) Gt(e, !0);
	else if (e.owned) {
		for (t = e.owned.length - 1; t >= 0; t--) K(e.owned[t]);
		e.owned = null;
	}
	if (e.cleanups) {
		for (t = e.cleanups.length - 1; t >= 0; t--) e.cleanups[t]();
		e.cleanups = null;
	}
	R && R.running ? e.tState = 0 : e.state = 0;
}
function Gt(e, t) {
	if (t || (e.tState = 0, R.disposed.add(e)), e.owned) for (let t = 0; t < e.owned.length; t++) Gt(e.owned[t]);
}
function Kt(e) {
	return e instanceof Error ? e : Error(typeof e == "string" ? e : "Unknown error", { cause: e });
}
function qt(e, t, n) {
	try {
		for (let n of t) n(e);
	} catch (e) {
		Jt(e, n && n.owner || null);
	}
}
function Jt(e, t = L) {
	let n = gt && t && t.context && t.context[gt], r = Kt(e);
	if (!n) throw r;
	V ? V.push({
		fn() {
			qt(r, n, t);
		},
		state: I
	}) : qt(r, n, t);
}
function Yt(e) {
	if (typeof e == "function" && !e.length) return Yt(e());
	if (Array.isArray(e)) {
		let t = [];
		for (let n = 0; n < e.length; n++) {
			let r = Yt(e[n]);
			if (Array.isArray(r)) {
				if (r.length < 32768) t.push.apply(t, r);
				else for (let e = 0; e < r.length; e++) t.push(r[e]);
			} else t.push(r);
		}
		return t;
	}
	return e;
}
function Xt(e, t) {
	return function(t) {
		let n;
		return U(() => n = W(() => (L.context = {
			...L.context,
			[e]: t.value
		}, Mt(() => t.children))), void 0), n;
	};
}
var Zt = Symbol("fallback");
function Qt(e) {
	for (let t = 0; t < e.length; t++) e[t]();
}
function $t(e, t, n = {}) {
	let r = [], i = [], a = [], o = 0, s = t.length > 1 ? [] : null;
	return Et(() => Qt(a)), () => {
		let c = e() || [], l = c.length, u, d;
		return c[mt], W(() => {
			let e, t, p, m, h, g, _, v, y;
			if (l === 0) o !== 0 && (Qt(a), a = [], r = [], i = [], o = 0, s &&= []), n.fallback && (r = [Zt], i[0] = xt((e) => (a[0] = e, n.fallback())), o = 1);
			else if (o === 0) {
				for (i = Array(l), d = 0; d < l; d++) r[d] = c[d], i[d] = xt(f);
				o = l;
			} else {
				for (p = Array(l), m = Array(l), s && (h = Array(l)), g = 0, _ = Math.min(o, l); g < _ && r[g] === c[g]; g++);
				for (_ = o - 1, v = l - 1; _ >= g && v >= g && r[_] === c[v]; _--, v--) p[v] = i[_], m[v] = a[_], s && (h[v] = s[_]);
				for (e = /* @__PURE__ */ new Map(), t = Array(v + 1), d = v; d >= g; d--) y = c[d], u = e.get(y), t[d] = u === void 0 ? -1 : u, e.set(y, d);
				for (u = g; u <= _; u++) y = r[u], d = e.get(y), d !== void 0 && d !== -1 ? (p[d] = i[u], m[d] = a[u], s && (h[d] = s[u]), d = t[d], e.set(y, d)) : a[u]();
				for (d = g; d < l; d++) d in p ? (i[d] = p[d], a[d] = m[d], s && (s[d] = h[d], s[d](d))) : i[d] = xt(f);
				i = i.slice(0, o = l), r = c.slice(0);
			}
			return i;
		});
		function f(e) {
			if (a[d] = e, s) {
				let [e, n] = H(d);
				return s[d] = n, t(c[d], e);
			}
			return t(c[d]);
		}
	};
}
function q(e, t) {
	return W(() => e(t || {}));
}
var en = (e) => `Stale read from <${e}>.`;
function tn(e) {
	let t = "fallback" in e && { fallback: () => e.fallback };
	return Ct($t(() => e.each, e.children, t || void 0));
}
function nn(e) {
	let t = e.keyed, n = Ct(() => e.when, void 0, void 0), r = t ? n : Ct(n, void 0, { equals: (e, t) => !e == !t });
	return Ct(() => {
		let i = r();
		if (i) {
			let a = e.children;
			return typeof a == "function" && a.length > 0 ? W(() => a(t ? i : () => {
				if (!W(r)) throw en("Show");
				return n();
			})) : a;
		}
		return e.fallback;
	}, void 0, void 0);
}
//#endregion
//#region node_modules/.pnpm/solid-js@1.9.14/node_modules/solid-js/web/dist/web.js
var rn = (e) => Ct(() => e());
function an(e, t, n) {
	let r = n.length, i = t.length, a = r, o = 0, s = 0, c = t[i - 1].nextSibling, l = null;
	for (; o < i || s < a;) {
		if (t[o] === n[s]) {
			o++, s++;
			continue;
		}
		for (; t[i - 1] === n[a - 1];) i--, a--;
		if (i === o) {
			let t = a < r ? s ? n[s - 1].nextSibling : n[a - s] : c;
			for (; s < a;) e.insertBefore(n[s++], t);
		} else if (a === s) for (; o < i;) (!l || !l.has(t[o])) && t[o].remove(), o++;
		else if (t[o] === n[a - 1] && n[s] === t[i - 1]) {
			let r = t[--i].nextSibling;
			e.insertBefore(n[s++], t[o++].nextSibling), e.insertBefore(n[--a], r), t[i] = n[a];
		} else {
			if (!l) {
				l = /* @__PURE__ */ new Map();
				let e = s;
				for (; e < a;) l.set(n[e], e++);
			}
			let r = l.get(t[o]);
			if (r != null) {
				if (s < r && r < a) {
					let c = o, u = 1, d;
					for (; ++c < i && c < a && (d = l.get(t[c])) != null && d === r + u;) u++;
					if (u > r - s) {
						let i = t[o];
						for (; s < r;) e.insertBefore(n[s++], i);
					} else e.replaceChild(n[s++], t[o++]);
				} else o++;
			} else t[o++].remove();
		}
	}
}
var on = "_$DX_DELEGATE";
function sn(e, t, n, r = {}) {
	let i;
	return xt((r) => {
		i = r, t === document ? e() : X(t, e(), t.firstChild ? null : void 0, n);
	}, r.owner), () => {
		i(), t.textContent = "";
	};
}
function J(e, t, n, r) {
	let i, a = () => {
		let t = r ? document.createElementNS("http://www.w3.org/1998/Math/MathML", "template") : document.createElement("template");
		return t.innerHTML = e, n ? t.content.firstChild.firstChild : r ? t.firstChild : t.content.firstChild;
	}, o = t ? () => W(() => document.importNode(i ||= a(), !0)) : () => (i ||= a()).cloneNode(!0);
	return o.cloneNode = o, o;
}
function Y(e, t = window.document) {
	let n = t[on] || (t[on] = /* @__PURE__ */ new Set());
	for (let r = 0, i = e.length; r < i; r++) {
		let i = e[r];
		n.has(i) || (n.add(i), t.addEventListener(i, fn));
	}
}
function cn(e, t) {
	dn(e) || (t == null ? e.removeAttribute("class") : e.className = t);
}
function ln(e, t, n) {
	n == null ? e.style.removeProperty(t) : e.style.setProperty(t, n);
}
function un(e, t, n) {
	return W(() => e(t, n));
}
function X(e, t, n, r) {
	if (n !== void 0 && !r && (r = []), typeof t != "function") return pn(e, t, r, n);
	U((r) => pn(e, t(), r, n), r);
}
function dn(e) {
	return !!F.context && !F.done && (!e || e.isConnected);
}
function fn(e) {
	if (F.registry && F.events && F.events.find(([t, n]) => n === e)) return;
	let t = e.target, n = `$$${e.type}`, r = e.target, i = e.currentTarget, a = (t) => Object.defineProperty(e, "target", {
		configurable: !0,
		value: t
	}), o = () => {
		let r = t[n];
		if (r && !t.disabled) {
			let i = t[`${n}Data`];
			if (i === void 0 ? r.call(t, e) : r.call(t, i, e), e.cancelBubble) return;
		}
		return t.host && typeof t.host != "string" && !t.host._$host && t.contains(e.target) && a(t.host), !0;
	}, s = () => {
		for (; o() && (t = t._$host || t.parentNode || t.host););
	};
	if (Object.defineProperty(e, "currentTarget", {
		configurable: !0,
		get() {
			return t || document;
		}
	}), F.registry && !F.done && (F.done = _$HY.done = !0), e.composedPath) {
		let n = e.composedPath();
		a(n[0]);
		for (let e = 0; e < n.length - 2 && (t = n[e], o()); e++) {
			if (t._$host) {
				t = t._$host, s();
				break;
			}
			if (t.parentNode === i) break;
		}
	} else s();
	a(r);
}
function pn(e, t, n, r, i) {
	let a = dn(e);
	if (a) {
		!n && (n = [...e.childNodes]);
		let t = [];
		for (let e = 0; e < n.length; e++) {
			let r = n[e];
			r.nodeType === 8 && r.data.slice(0, 2) === "!$" ? r.remove() : t.push(r);
		}
		n = t;
	}
	for (; typeof n == "function";) n = n();
	if (t === n) return n;
	let o = typeof t, s = r !== void 0;
	if (e = s && n[0] && n[0].parentNode || e, o === "string" || o === "number") {
		if (a || o === "number" && (t = t.toString(), t === n)) return n;
		if (s) {
			let i = n[0];
			i && i.nodeType === 3 ? i.data !== t && (i.data = t) : i = document.createTextNode(t), n = gn(e, n, r, i);
		} else n = n !== "" && typeof n == "string" ? e.firstChild.data = t : e.textContent = t;
	} else if (t == null || o === "boolean") {
		if (a) return n;
		n = gn(e, n, r);
	} else if (o === "function") return U(() => {
		let i = t();
		for (; typeof i == "function";) i = i();
		n = pn(e, i, n, r);
	}), () => n;
	else if (Array.isArray(t)) {
		let o = [], c = n && Array.isArray(n);
		if (mn(o, t, n, i)) return U(() => n = pn(e, o, n, r, !0)), () => n;
		if (a) {
			if (!o.length) return n;
			if (r === void 0) return n = [...e.childNodes];
			let t = o[0];
			if (t.parentNode !== e) return n;
			let i = [t];
			for (; (t = t.nextSibling) !== r;) i.push(t);
			return n = i;
		}
		if (o.length === 0) {
			if (n = gn(e, n, r), s) return n;
		} else c ? n.length === 0 ? hn(e, o, r) : an(e, n, o) : (n && gn(e), hn(e, o));
		n = o;
	} else if (t.nodeType) {
		if (a && t.parentNode) return n = s ? [t] : t;
		if (Array.isArray(n)) {
			if (s) return n = gn(e, n, r, t);
			gn(e, n, null, t);
		} else n == null || n === "" || !e.firstChild ? e.appendChild(t) : e.replaceChild(t, e.firstChild);
		n = t;
	}
	return n;
}
function mn(e, t, n, r) {
	let i = !1;
	for (let a = 0, o = t.length; a < o; a++) {
		let o = t[a], s = n && n[e.length], c;
		if (o != null && o !== !0 && o !== !1) {
			if ((c = typeof o) == "object" && o.nodeType) e.push(o);
			else if (Array.isArray(o)) i = mn(e, o, s) || i;
			else if (c === "function") {
				if (r) {
					for (; typeof o == "function";) o = o();
					i = mn(e, Array.isArray(o) ? o : [o], Array.isArray(s) ? s : [s]) || i;
				} else e.push(o), i = !0;
			} else {
				let t = String(o);
				s && s.nodeType === 3 && s.data === t ? e.push(s) : e.push(document.createTextNode(t));
			}
		}
	}
	return i;
}
function hn(e, t, n = null) {
	for (let r = 0, i = t.length; r < i; r++) e.insertBefore(t[r], n);
}
function gn(e, t, n, r) {
	if (n === void 0) return e.textContent = "";
	let i = r || document.createTextNode("");
	if (t.length) {
		let r = !1;
		for (let a = t.length - 1; a >= 0; a--) {
			let o = t[a];
			if (i !== o) {
				let t = o.parentNode === e;
				!r && !a ? t ? e.replaceChild(i, o) : e.insertBefore(i, n) : t && o.remove();
			} else r = !0;
		}
	} else e.insertBefore(i, n);
	return [i];
}
//#endregion
//#region node_modules/.pnpm/solid-js@1.9.14/node_modules/solid-js/store/dist/store.js
var _n = Symbol("store-raw"), vn = Symbol("store-node"), Z = Symbol("store-has"), yn = Symbol("store-self");
function bn(e) {
	let t = e[pt];
	if (!t && (Object.defineProperty(e, pt, { value: t = new Proxy(e, On) }), !Array.isArray(e))) {
		let n = Object.keys(e), r = Object.getOwnPropertyDescriptors(e), i = Object.getPrototypeOf(e), a = i !== null && typeof e == "object" && !!e && !Array.isArray(e) && i !== Object.prototype;
		if (a) {
			let e = Object.getOwnPropertyDescriptors(i);
			n.push(...Object.keys(e)), Object.assign(r, e);
		}
		for (let i = 0, o = n.length; i < o; i++) {
			let o = n[i];
			a && o === "constructor" || r[o].get && Object.defineProperty(e, o, {
				configurable: !0,
				enumerable: r[o].enumerable,
				get: r[o].get.bind(t)
			});
		}
	}
	return t;
}
function xn(e) {
	let t;
	return typeof e == "object" && !!e && (e[pt] || !(t = Object.getPrototypeOf(e)) || t === Object.prototype || Array.isArray(e));
}
function Sn(e, t = /* @__PURE__ */ new Set()) {
	let n, r, i, a;
	if (n = e != null && e[_n]) return n;
	if (!xn(e) || t.has(e)) return e;
	if (Array.isArray(e)) {
		Object.isFrozen(e) ? e = e.slice(0) : t.add(e);
		for (let n = 0, a = e.length; n < a; n++) i = e[n], (r = Sn(i, t)) !== i && (e[n] = r);
	} else {
		Object.isFrozen(e) ? e = Object.assign({}, e) : t.add(e);
		let n = Object.keys(e), o = Object.getOwnPropertyDescriptors(e);
		for (let s = 0, c = n.length; s < c; s++) a = n[s], !o[a].get && (i = e[a], (r = Sn(i, t)) !== i && (e[a] = r));
	}
	return e;
}
function Cn(e, t) {
	let n = e[t];
	return n || Object.defineProperty(e, t, { value: n = Object.create(null) }), n;
}
function wn(e, t, n) {
	if (e[t]) return e[t];
	let [r, i] = H(n, {
		equals: !1,
		internal: !0
	});
	return r.$ = i, e[t] = r;
}
function Tn(e, t) {
	let n = Reflect.getOwnPropertyDescriptor(e, t);
	return !n || n.get || !n.configurable || t === pt || t === vn ? n : (delete n.value, delete n.writable, n.get = () => e[pt][t], n);
}
function En(e) {
	Dt() && wn(Cn(e, vn), yn)();
}
function Dn(e) {
	return En(e), Reflect.ownKeys(e);
}
var On = {
	get(e, t, n) {
		if (t === _n) return e;
		if (t === pt) return n;
		if (t === mt) return En(e), n;
		let r = Cn(e, vn), i = r[t], a = i ? i() : e[t];
		if (t === vn || t === Z || t === "__proto__") return a;
		if (!i) {
			let n = Object.getOwnPropertyDescriptor(e, t);
			Dt() && (typeof a != "function" || Object.prototype.hasOwnProperty.call(e, t)) && !(n && n.get) && (a = wn(r, t, a)());
		}
		return xn(a) ? bn(a) : a;
	},
	has(e, t) {
		return t === _n || t === pt || t === mt || t === vn || t === Z || t === "__proto__" || (Dt() && wn(Cn(e, Z), t)(), t in e);
	},
	set() {
		return !0;
	},
	deleteProperty() {
		return !0;
	},
	ownKeys: Dn,
	getOwnPropertyDescriptor: Tn
};
function kn(e, t, n, r = !1) {
	if (t === "__proto__" || !r && e[t] === n) return;
	let i = e[t], a = e.length;
	n === void 0 ? (delete e[t], e[Z] && e[Z][t] && i !== void 0 && e[Z][t].$()) : (e[t] = n, e[Z] && e[Z][t] && i === void 0 && e[Z][t].$());
	let o = Cn(e, vn), s;
	if ((s = wn(o, t, i)) && s.$(() => n), Array.isArray(e) && e.length !== a) {
		for (let t = e.length; t < a; t++) (s = o[t]) && s.$();
		(s = wn(o, "length", a)) && s.$(e.length);
	}
	(s = o[yn]) && s.$();
}
function An(e, t) {
	let n = Object.keys(t);
	for (let r = 0; r < n.length; r += 1) {
		let i = n[r];
		jn(i) || kn(e, i, t[i]);
	}
}
function jn(e) {
	return e === "__proto__" || e === "constructor" || e === "prototype";
}
function Mn(e, t) {
	if (typeof t == "function" && (t = t(e)), t = Sn(t), Array.isArray(t)) {
		if (e === t) return;
		let n = 0, r = t.length;
		for (; n < r; n++) {
			let r = t[n];
			e[n] !== r && kn(e, n, r);
		}
		kn(e, "length", r);
	} else An(e, t);
}
function Nn(e, t, n = []) {
	let r, i = e;
	if (t.length > 1) {
		r = t.shift();
		let a = typeof r, o = Array.isArray(e);
		if (a === "string" && (r === "__proto__" || t.length > 1 && jn(r))) return;
		if (Array.isArray(r)) {
			for (let i = 0; i < r.length; i++) Nn(e, [r[i]].concat(t), n);
			return;
		}
		if (o && a === "function") {
			for (let i = 0; i < e.length; i++) r(e[i], i) && Nn(e, [i].concat(t), n);
			return;
		}
		if (o && a === "object") {
			let { from: i = 0, to: a = e.length - 1, by: o = 1 } = r;
			for (let r = i; r <= a; r += o) Nn(e, [r].concat(t), n);
			return;
		}
		if (t.length > 1) {
			Nn(e[r], t, [r].concat(n));
			return;
		}
		i = e[r], n = [r].concat(n);
	}
	let a = t[0];
	typeof a == "function" && (a = a(i, n), a === i) || (r !== void 0 || a != null) && (a = Sn(a), r === void 0 || xn(i) && xn(a) && !Array.isArray(a) ? An(i, a) : kn(e, r, a));
}
function Pn(...[e, t]) {
	let n = Sn(e || {}), r = Array.isArray(n), i = bn(n);
	function a(...e) {
		wt(() => {
			r && e.length === 1 ? Mn(n, e[0]) : Nn(n, e);
		});
	}
	return [i, a];
}
//#endregion
//#region src/PlayerInterface/Loading/index.tsx
var Fn = /*#__PURE__*/ J("<div class=hlv-loading><div class=hlv-loading-spinner><svg xmlns=http://www.w3.org/2000/svg x=0px y=0px width=80px height=80px viewBox=\"0 0 80 80\"><title>Loading</title><path fill=#ffffff d=M40,72C22.4,72,8,57.6,8,40C8,22.4,22.4,8,40,8c17.6,0,32,14.4,32,32c0,1.1-0.9,2-2,2s-2-0.9-2-2c0-15.4-12.6-28-28-28S12,24.6,12,40s12.6,28,28,28c1.1,0,2,0.9,2,2S41.1,72,40,72z></path></svg></div><div class=hlv-loading-log>"), In = /*#__PURE__*/ J("<div class=hlv-loading-log-item>"), Ln = {
	replay: "Replay",
	bsp: "Map",
	sound: "Sounds",
	sky: "Skybox",
	sprite: "Sprites",
	wad: "Wads"
};
function Rn(e) {
	let [t, n] = Pn({});
	Tt(() => {
		let t = e.game.loader.events, n = t.on("loadstart", r), a = t.on("progress", i);
		Et(() => {
			n?.(), a?.();
		});
	});
	let r = (e) => {
		let r = t[e.type] ? t[e.type] : [];
		for (let t = 0; t < r.length; ++t) if (r[t] === e) return;
		r.push({
			name: e.name,
			progress: 0
		}), n(e.type, r);
	}, i = (e) => {
		if (!t[e.type]) return;
		let r = t[e.type];
		for (let t = 0; t < r.length; ++t) if (r[t].name === e.name) {
			n(e.type, t, { progress: e.progress });
			break;
		}
	}, a = (e, t) => {
		let n = e;
		n = Ln[n];
		let r = `${Math.round(t * 100)}%`, i = 29 - n.length - r.length;
		i < 2 && (i = 9 - r.length);
		let a = Array(i).join(".");
		return `${n}${a}${r}`;
	};
	return (() => {
		var n = Fn(), r = n.firstChild.nextSibling;
		return X(r, q(tn, {
			get each() {
				return Object.entries(t);
			},
			children: ([e, t]) => (() => {
				var n = In();
				return X(n, () => a(e, t.reduce((e, t) => e + t.progress, 0) / t.length)), n;
			})()
		})), U(() => n.classList.toggle("visible", !!e.visible)), n;
	})();
}
//#endregion
//#region src/PlayerInterface/Buttons/SettingsButton/index.tsx
var zn = /*#__PURE__*/ J("<div class=hlv-settings><button type=button class=hlv-button><svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><title>Toggle</title><path stroke=none d=\"M0 0h24v24H0z\"fill=none></path><path d=\"M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z\"></path><path d=\"M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\"></path></svg></button><div class=hlv-settings-menu><span class=hlv-settings-menu-title>Mode</span><button type=button class=hlv-settings-menu-item>Free Move"), Bn = /*#__PURE__*/ J("<button type=button class=hlv-settings-menu-item>Replay"), Vn = /*#__PURE__*/ J("<span>");
function Hn(e) {
	let [t, n] = H(!1), r = !!e.game.player.replay, i = () => {
		e.game.mode !== P.FREE && (e.game.changeMode(P.FREE), e.game.player.pause());
	}, a = () => {
		e.game.mode !== P.REPLAY && e.game.changeMode(P.REPLAY);
	};
	return (() => {
		var o = zn(), s = o.firstChild, c = s.nextSibling, l = c.firstChild.nextSibling;
		return s.$$click = () => n(!t()), X(c, r ? (() => {
			var t = Bn();
			return t.$$click = () => a(), U(() => t.classList.toggle("selected", e.game.mode === P.REPLAY)), t;
		})() : Vn(), l), l.$$click = () => i(), U((n) => {
			var r = !!t(), i = e.game.mode === P.FREE;
			return r !== n.e && o.classList.toggle("open", n.e = r), i !== n.t && l.classList.toggle("selected", n.t = i), n;
		}, {
			e: void 0,
			t: void 0
		}), o;
	})();
}
Y(["click"]);
//#endregion
//#region src/Fullscreen.ts
var Q = [
	{
		enabled: "fullscreenEnabled",
		element: "fullscreenElement",
		request: "requestFullscreen",
		exit: "exitFullscreen",
		change: "fullscreenchange",
		error: "fullscreenerror"
	},
	{
		enabled: "mozFullScreenEnabled",
		element: "mozFullScreenElement",
		request: "mozRequestFullScreen",
		exit: "mozCancelFullScreen",
		change: "mozfullscreenchange",
		error: "mozfullscreenerror"
	},
	{
		enabled: "webkitFullscreenEnabled",
		element: "webkitCurrentFullScreenElement",
		request: "webkitRequestFullscreen",
		exit: "webkitExitFullscreen",
		change: "webkitfullscreenchange",
		error: "webkitfullscreenerror"
	},
	{
		enabled: "msFullscreenEnabled",
		element: "msFullscreenElement",
		request: "msRequestFullscreen",
		exit: "msExitFullscreen",
		change: "MSFullscreenChange",
		error: "MSFullscreenError"
	}
], Un = 0, Wn = document;
for (let e = 0; e < Q.length; ++e) if (Wn[Q[e].enabled] !== void 0) {
	Un = e;
	break;
}
var $ = {
	element() {
		return Wn[Q[Un].element];
	},
	enabled() {
		return Wn[Q[Un].enabled];
	},
	isInFullscreen() {
		return $.element() !== null;
	},
	enter(e) {
		e[Q[Un].request]();
	},
	exit() {
		Wn[Q[Un].exit]();
	},
	onChange(e) {
		return window.addEventListener(Q[Un].change, e);
	},
	onChangeRemove(e) {
		window.removeEventListener(Q[Un].change, e);
	},
	onError(e) {
		return window.addEventListener(Q[Un].error, e);
	}
}, Gn = /*#__PURE__*/ J("<button type=button class=\"hlv-button hlv-fullscreen-button\">"), Kn = /*#__PURE__*/ J("<svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round class=\"icon icon-tabler icons-tabler-outline icon-tabler-minimize\"><title>Exit fullscreen</title><path stroke=none d=\"M0 0h24v24H0z\"fill=none></path><path d=\"M15 19v-2a2 2 0 0 1 2 -2h2\"></path><path d=\"M15 5v2a2 2 0 0 0 2 2h2\"></path><path d=\"M5 15h2a2 2 0 0 1 2 2v2\"></path><path d=\"M5 9h2a2 2 0 0 0 2 -2v-2\">"), qn = /*#__PURE__*/ J("<svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><title>Fullscreen</title><path stroke=none d=\"M0 0h24v24H0z\"fill=none></path><path d=\"M4 8v-2a2 2 0 0 1 2 -2h2\"></path><path d=\"M4 16v2a2 2 0 0 0 2 2h2\"></path><path d=\"M16 4h2a2 2 0 0 1 2 2v2\"></path><path d=\"M16 20h2a2 2 0 0 0 2 -2v-2\">");
function Jn(e) {
	let [t, n] = H($.isInFullscreen());
	Tt(() => {
		$.onChange(i);
	}), Et(() => {
		$.onChangeRemove(i);
	});
	let r = () => {
		$.isInFullscreen() ? $.exit() : $.enter(e.root);
	}, i = () => {
		n($.isInFullscreen());
	};
	return (() => {
		var e = Gn();
		return e.$$click = () => r(), X(e, (() => {
			var e = rn(() => !!t());
			return () => e() ? Kn() : qn();
		})()), e;
	})();
}
Y(["click"]);
//#endregion
//#region src/PlayerInterface/FreeMode/index.tsx
var Yn = /*#__PURE__*/ J("<div><div class=hlv-buttons><div class=hlv-buttons-left></div><div class=hlv-buttons-right>");
function Xn(e) {
	return (() => {
		var t = Yn(), n = t.firstChild.firstChild.nextSibling;
		return X(n, q(Hn, { get game() {
			return e.game;
		} }), null), X(n, q(Jn, {
			active: !1,
			get root() {
				return e.root;
			}
		}), null), U(() => cn(t, e.class)), t;
	})();
}
//#endregion
//#region src/PlayerInterface/GameState.tsx
var Zn = At({
	mode: P.FREE,
	time: 0,
	volume: 1,
	isPlaying: !1,
	isPaused: !1
});
function Qn() {
	return jt(Zn);
}
//#endregion
//#region src/PlayerInterface/Time/index.tsx
var $n = /*#__PURE__*/ J("<div class=hlv-time> / ");
function er(e) {
	let t = Qn(), r = () => n(t.time), i = () => n(e.player.replay.length);
	return (() => {
		var e = $n(), t = e.firstChild;
		return X(e, r, t), X(e, i, null), e;
	})();
}
//#endregion
//#region src/PlayerInterface/Timeline/index.tsx
var tr = /*#__PURE__*/ J("<button type=button class=hlv-timeline><div class=hlv-timeline-ghostline></div><div class=hlv-timeline-line></div><div class=hlv-timeline-knob></div><div class=hlv-timeline-ghosttime>");
function nr(e) {
	let [t, r] = H(0), [i, a] = H(!1), [o, s] = H("0%"), [c, l] = H(0);
	Tt(() => {
		let t = e.game.events.on("postupdate", () => {
			r(e.game.player.currentTime / e.game.player.replay.length);
		});
		Et(() => {
			t?.();
		});
	});
	let u = (t) => {
		let n = t.currentTarget.getClientRects()[0], r = 1 - (n.right - t.pageX) / (n.right - n.left);
		e.game.player.seekByPercent(r * 100), e.game.player.pause();
		let i = (t) => {
			let r = Math.max(0, Math.min(1 - (n.right - t.pageX) / (n.right - n.left), 1));
			e.game.player.seekByPercent(r * 100), e.game.player.pause();
		};
		window.addEventListener("mousemove", i), window.addEventListener("mouseup", () => {
			window.removeEventListener("mousemove", i);
		}, { once: !0 });
	}, d = (t) => {
		let n = t.currentTarget.getClientRects()[0], r = Math.max(0, Math.min(1 - (n.right - t.pageX) / (n.right - n.left), 1));
		i() && (s(`${r * 100}%`), l(e.game.player.replay.length * r));
	}, f = () => {
		a(!0);
	}, p = () => {
		a(!1);
	}, m = () => `${t() * 100}%`, h = () => `${100 - t() * 100}%`;
	return (() => {
		var e = tr(), t = e.firstChild.nextSibling, r = t.nextSibling, i = r.nextSibling;
		return e.addEventListener("mouseleave", () => p()), e.addEventListener("mouseenter", () => f()), e.$$mousemove = (e) => d(e), e.$$mousedown = (e) => u(e), X(i, () => n(c())), U((e) => {
			var n = h(), a = m(), s = o();
			return n !== e.e && ln(t, "right", e.e = n), a !== e.t && ln(r, "left", e.t = a), s !== e.a && ln(i, "left", e.a = s), e;
		}, {
			e: void 0,
			t: void 0,
			a: void 0
		}), e;
	})();
}
Y(["mousedown", "mousemove"]);
//#endregion
//#region src/PlayerInterface/VolumeControl/index.tsx
var rr = /*#__PURE__*/ J("<div class=hlv-volume><div class=hlv-volume-ghostline></div><div class=hlv-volume-line></div><div class=hlv-volume-knob>");
function ir(e) {
	let t = Qn(), n = (t) => {
		let n = t.currentTarget.getClientRects()[0], r = 1 - (n.right - t.pageX) / (n.right - n.left);
		e.game.soundSystem.setVolume(r);
		let i = (t) => {
			let r = Math.max(0, Math.min(1 - (n.right - t.pageX) / (n.right - n.left), 1));
			e.game.soundSystem.setVolume(r);
		};
		window.addEventListener("mousemove", i), window.addEventListener("mouseup", () => {
			window.removeEventListener("mousemove", i);
		}, { once: !0 });
	}, r = () => t.volume * 100, i = () => `${Math.min(95, Math.max(5, r()))}%`, a = () => `${Math.min(95, Math.max(5, 100 - r()))}%`;
	return (() => {
		var e = rr(), t = e.firstChild.nextSibling, r = t.nextSibling;
		return e.$$mousedown = (e) => n(e), U((e) => {
			var n = a(), o = i();
			return n !== e.e && ln(t, "right", e.e = n), o !== e.t && ln(r, "left", e.t = o), e;
		}, {
			e: void 0,
			t: void 0
		}), e;
	})();
}
Y(["mousedown"]);
//#endregion
//#region src/PlayerInterface/Buttons/PlayButton/index.tsx
var ar = /*#__PURE__*/ J("<button type=button class=hlv-button><svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><title>Play</title><path stroke=none d=\"M0 0h24v24H0z\"fill=none></path><path d=\"M7 4v16l13 -8z\">");
function or(e) {
	return (() => {
		var t = ar();
		return t.$$click = () => e.onClick(), t;
	})();
}
Y(["click"]);
//#endregion
//#region src/PlayerInterface/Buttons/PauseButton/index.tsx
var sr = /*#__PURE__*/ J("<button type=button class=hlv-button><svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><title>Pause</title><path stroke=none d=\"M0 0h24v24H0z\"fill=none></path><path d=\"M6 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z\"></path><path d=\"M14 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z\">");
function cr(e) {
	return (() => {
		var t = sr();
		return t.$$click = () => e.onClick(), t;
	})();
}
Y(["click"]);
//#endregion
//#region src/PlayerInterface/Buttons/VolumeButton/VolumeFull.tsx
var lr = /*#__PURE__*/ J("<svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><title>Volume Full</title><path stroke=none d=\"M0 0h24v24H0z\"fill=none></path><path d=\"M15 8a5 5 0 0 1 0 8\"></path><path d=\"M17.7 5a9 9 0 0 1 0 14\"></path><path d=\"M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5\">");
function ur() {
	return lr();
}
//#endregion
//#region src/PlayerInterface/Buttons/VolumeButton/VolumeHalf.tsx
var dr = /*#__PURE__*/ J("<svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round class=\"icon icon-tabler icons-tabler-outline icon-tabler-volume-2\"><title>Volume Half</title><path stroke=none d=\"M0 0h24v24H0z\"fill=none></path><path d=\"M15 8a5 5 0 0 1 0 8\"></path><path d=\"M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5\">");
function fr() {
	return dr();
}
//#endregion
//#region src/PlayerInterface/Buttons/VolumeButton/VolumeMute.tsx
var pr = /*#__PURE__*/ J("<svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round class=\"icon icon-tabler icons-tabler-outline icon-tabler-volume-3\"><title>Volume Mute</title><path stroke=none d=\"M0 0h24v24H0z\"fill=none></path><path d=\"M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5\"></path><path d=\"M16 10l4 4m0 -4l-4 4\">");
function mr() {
	return pr();
}
//#endregion
//#region src/PlayerInterface/Buttons/VolumeButton/index.tsx
var hr = /*#__PURE__*/ J("<button type=button class=hlv-button>");
function gr(e) {
	let t = Qn();
	return (() => {
		var n = hr();
		return n.$$click = () => e.onClick(), X(n, (() => {
			var e = rn(() => t.volume === 0);
			return () => e() ? q(mr, {}) : rn(() => t.volume > .5)() ? q(ur, {}) : q(fr, {});
		})()), n;
	})();
}
Y(["click"]);
//#endregion
//#region src/PlayerInterface/Buttons/SpeedUpButton/index.tsx
var _r = /*#__PURE__*/ J("<button type=button class=hlv-button><svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><title>Speed Up</title><path stroke=none d=\"M0 0h24v24H0z\"fill=none></path><path d=\"M3 5v14l8 -7z\"></path><path d=\"M14 5v14l8 -7z\">");
function vr(e) {
	return (() => {
		var t = _r();
		return t.$$click = () => e.onClick(), t;
	})();
}
Y(["click"]);
//#endregion
//#region src/PlayerInterface/Buttons/SpeedDownButton/index.tsx
var yr = /*#__PURE__*/ J("<button type=button class=hlv-button><svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox=\"0 0 24 24\"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><title>Speed Down</title><path stroke=none d=\"M0 0h24v24H0z\"fill=none></path><path d=\"M21 5v14l-8 -7z\"></path><path d=\"M10 5v14l-8 -7z\">");
function br(e) {
	return (() => {
		var t = yr();
		return t.$$click = () => e.onClick(), t;
	})();
}
Y(["click"]);
//#endregion
//#region src/PlayerInterface/ReplayMode/index.tsx
var xr = /*#__PURE__*/ J("<div><div class=hlv-buttons><div class=hlv-buttons-left><div></div><div></div></div><div class=hlv-buttons-right>");
function Sr(e) {
	let t = Qn(), n = () => {
		e.game.player.play();
	}, r = () => {
		e.game.player.pause();
	}, i = () => {
		e.game.player.speedDown();
	}, a = () => {
		e.game.player.speedUp();
	}, o = () => {
		e.game.soundSystem.toggleMute();
	};
	return (() => {
		var s = xr(), c = s.firstChild, l = c.firstChild, u = l.firstChild;
		u.nextSibling;
		var d = l.nextSibling;
		return X(s, q(nr, { get game() {
			return e.game;
		} }), c), X(l, q(br, { onClick: () => i() }), u), X(l, (() => {
			var e = rn(() => !!(t.isPaused || !t.isPlaying));
			return () => e() ? q(or, { onClick: () => n() }) : q(cr, { onClick: () => r() });
		})(), u), X(l, q(vr, { onClick: () => a() }), u), X(l, q(gr, { onClick: () => o() }), null), X(l, q(ir, { get game() {
			return e.game;
		} }), null), X(l, q(er, { get player() {
			return e.game.player;
		} }), null), X(d, q(Hn, { get game() {
			return e.game;
		} }), null), X(d, q(Jn, {
			active: !0,
			get root() {
				return e.root;
			}
		}), null), U(() => cn(s, e.class)), s;
	})();
}
//#endregion
//#region src/PlayerInterface/App/index.tsx
var Cr = /*#__PURE__*/ J("<div class=hlv-app><div class=hlv-title></div><button type=button class=hlv-screen>");
function wr(e) {
	let t = null, n, [r, i] = H(e.game.title), [a, o] = H(!1), [s, c] = H(!1), [l, u] = H(!1), [d, f] = H(!1), [p, m] = Pn({
		mode: e.game.mode,
		time: e.game.player.currentTime,
		volume: e.game.soundSystem.getVolume(),
		isPlaying: e.game.player.isPlaying,
		isPaused: e.game.player.isPaused
	});
	Tt(() => {
		if (!t) return;
		let n = e.game, r = e.root;
		t.appendChild(n.getCanvas());
		let a = n.events.on("loadstart", () => c(!0)), o = n.events.on("load", () => c(!1)), s = n.events.on("modechange", (e) => m({ mode: e })), l = n.events.on("titlechange", (e) => i(e)), u = e.game.player.events.on("play", () => m({
			isPlaying: !0,
			isPaused: !1
		})), d = e.game.player.events.on("pause", () => m({
			isPlaying: !0,
			isPaused: !0
		})), f = e.game.player.events.on("stop", () => m({
			isPlaying: !1,
			isPaused: !1
		})), p = e.game.soundSystem.events.on("volumeChange", () => {
			m({ volume: e.game.soundSystem.getVolume() });
		}), C, w = () => {
			C = setInterval(() => {
				m({ time: e.game.player.currentTime });
			}, 100);
		}, T = () => {
			clearInterval(C);
		}, ee = e.game.player.events.on("play", w), te = e.game.player.events.on("pause", T), ne = e.game.player.events.on("stop", T), E = e.game.player.events.on("seek", (e) => m({ time: e }));
		window.addEventListener("click", _), window.addEventListener("keydown", y), document.addEventListener("pointerlockchange", h, !1), r.addEventListener("click", v), r.addEventListener("mouseover", b), r.addEventListener("mousemove", x), r.addEventListener("mouseout", S), r.addEventListener("contextmenu", g), Et(() => {
			a?.(), o?.(), s?.(), l?.(), u?.(), d?.(), f?.(), p?.(), ee?.(), te?.(), ne?.(), E?.(), e.root.removeEventListener("click", v), window.removeEventListener("click", _), window.removeEventListener("keydown", y), document.removeEventListener("pointerlockchange", h, !1), e.root.removeEventListener("mouseover", b), e.root.removeEventListener("mousemove", x), e.root.removeEventListener("mouseout", S), e.root.removeEventListener("contextmenu", g);
		});
	});
	let h = () => {
		document.pointerLockElement === e.root ? e.game.pointerLocked = !0 : e.game.pointerLocked = !1;
	}, g = (e) => {
		e.preventDefault();
	}, _ = (e) => {
		e.target.closest(".hlv-app") || o(!1);
	}, v = () => {
		o(!0), C();
	}, y = (t) => {
		if (a() && p.mode !== P.FREE) switch (t.code) {
			case "KeyF":
				$.isInFullscreen() ? $.exit() : $.enter(e.root), C();
				break;
			case "KeyM":
				e.game.soundSystem.toggleMute(), C();
				break;
			case "ArrowUp":
				e.game.soundSystem.setVolume(e.game.soundSystem.getVolume() + .05), C();
				break;
			case "ArrowDown":
				e.game.soundSystem.setVolume(e.game.soundSystem.getVolume() - .05), C();
				break;
			case "KeyJ":
			case "ArrowLeft":
				e.game.player.seek(e.game.player.currentTime - 5), C();
				break;
			case "KeyL":
			case "ArrowRight":
				e.game.player.seek(e.game.player.currentTime + 5), C();
				break;
			case "KeyK":
			case "Space":
				if (p.mode !== P.REPLAY) return;
				!e.game.player.isPlaying || e.game.player.isPaused ? e.game.player.play() : e.game.player.pause();
		}
	}, b = () => {
		u(!0), C();
	}, x = () => {
		l() && !$.isInFullscreen() && C();
	}, S = () => {
		u(!1), f(!1), clearTimeout(n), n = void 0;
	}, C = () => {
		d() || f(!0), clearTimeout(n), n = setTimeout(() => {
			f(!1), n = void 0;
		}, 2e3);
	}, w = () => {
		switch (p.mode) {
			case P.REPLAY: {
				let t = e.game.player;
				!t.isPlaying || t.isPaused ? t.play() : t.pause();
				break;
			}
			case P.FREE: e.root.requestPointerLock();
		}
	}, T = () => {
		$.isInFullscreen() ? $.exit() : $.enter(e.root);
	};
	return q(Zn.Provider, {
		value: p,
		get children() {
			var n = Cr(), i = n.firstChild, a = i.nextSibling;
			return X(i, r), X(n, q(Rn, {
				get game() {
					return e.game;
				},
				get visible() {
					return s();
				}
			}), a), a.$$dblclick = () => T(), a.$$click = () => w(), un((e) => {
				t = e;
			}, a), X(n, q(nn, {
				get when() {
					return p.mode === P.FREE;
				},
				get children() {
					return q(Xn, {
						class: "hlv-controls",
						get game() {
							return e.game;
						},
						get root() {
							return e.root;
						}
					});
				}
			}), null), X(n, q(nn, {
				get when() {
					return p.mode === P.REPLAY;
				},
				get children() {
					return q(Sr, {
						class: "hlv-controls",
						get game() {
							return e.game;
						},
						get root() {
							return e.root;
						},
						get visible() {
							return l();
						}
					});
				}
			}), null), U((e) => {
				var t = !!d(), r = p.mode === P.FREE, i = p.mode === P.REPLAY;
				return t !== e.e && n.classList.toggle("visible", e.e = t), r !== e.t && n.classList.toggle("mode-free", e.t = r), i !== e.a && n.classList.toggle("mode-replay", e.a = i), e;
			}, {
				e: void 0,
				t: void 0,
				a: void 0
			}), n;
		}
	});
}
Y(["click", "dblclick"]);
//#endregion
//#region src/PlayerInterface/index.tsx
var Tr = class {
	game;
	rootNode;
	constructor(e, t) {
		this.game = e, this.rootNode = t;
	}
	getRootNode() {
		return this.rootNode;
	}
	draw() {
		sn(() => {
			let e = this;
			return q(wr, {
				get game() {
					return e.game;
				},
				get root() {
					return e.rootNode;
				}
			});
		}, this.rootNode);
	}
}, Er = class {
	static VERSION = "0.8.5";
	game;
	constructor(e) {
		this.game = e;
	}
	load(e) {
		this.game.load(e);
	}
	setTitle(e) {
		this.game.setTitle(e);
	}
	getTitle() {
		return this.game.getTitle();
	}
}, Dr;
(function(e) {
	function t(e, t) {
		let n = document.querySelector(e);
		if (!n) return null;
		let r = lt.init(t), i = ct.init(r);
		if (i.status === "success") {
			let e = i.game;
			return new Tr(e, n).draw(), e.draw(), new Er(e);
		}
		return null;
	}
	e.init = t;
})(Dr ||= {}), typeof window < "u" && Object.assign(window, { HLViewer: Dr });
//#endregion
export { Dr as HLViewer, de as Replay };
