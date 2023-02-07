const synth = new Synth();

title = "Sandulation";
document.getElementsByTagName("link")[0].href = "./favicon.ico";

const controls = {
	"Touch/Click": "Draw with current brush",
	"Up/Down Arrows": "Change brush size",
	"</> & Left/Right Arrows": "Change brush type",
	"p": "Toggle erase only",
	"Space": "Pause/Play",
	"Enter": "Advance one step while paused",
	"s": "Open element selection window",
	"d": "Save current world locally",
	"u": "Reset most recently saved/loaded world",
	"Shift + d": "Download current world to file",
	"Shift + u": "Upload world from file",
	"r": "Reset world",
	"e": "Restore zoom",
	"Shift + = & Mouse Wheel Up": "Zoom in",
	"Shift + - & Mouse Wheel Down": "Zoom out",
	"Shift + Arrow Keys & Control + Drag": "Move camera",
	"Control + Click & Drag": "Move camera",
	"g": "Toggle 'RTX'",
	"a": "Animate Wall"
};

canvas.clearScreen = () => renderer.fill(Color.BLACK);

const TYPES = Object.fromEntries([
	"AIR",
	"TEST",
	"THICKET_SEED", "THICKET", "THICKET_BUD", "THICKET_STEM", "INCENSE_SMOKE", "INCENSE",
	"SUNFLOWER_PETAL", "SUNFLOWER_STEM", "SUNFLOWER_SEED",
	"SOIL", "DAMP_SOIL", "ROOT", "GRASS", "FLOWER",
	"HIGH_EXPLOSIVE", "EXPLOSIVE", "EXPLOSIVE_DUST",
	"STONE", "CONDENSED_STONE", "MARBLE",
	"CLAY", "BRICK",
	"TILE_BASE", "DECUMAN_TILE",
	"GLAZE_BASE", "DECUMAN_GLAZE",
	"PRIDIUM", "GENDERFLUID",
	"PARTICLE",
	"EXOTHERMIA", "FIRE", "BLUE_FIRE",
	"BAHHUM",
	"ESTIUM", "ESTIUM_GAS",
	"DDT", "ANT", "BEE", "HIVE", "HONEY", "SUGAR",
	"WATER", "ICE", "SNOW", "STAINED_SNOW", "SALT", "SALT_WATER",
	"SAND", "KELP", "KELP_TOP", "PNEUMATOCYST",
	"WOOD", "COAL", "OIL", "FUSE", "ASH",
	"WAX", "GRAINY_WAX", "MOLTEN_WAX",
	"LAVA", "POWER_LAVA",
	"STEAM", "SMOKE", "HYDROGEN",
	"GLASS", "ACID",
	"BATTERY", "ELECTRICITY", "CONVEYOR_LEFT", "CONVEYOR_RIGHT", "STEEL",
	"COPPER", "LIQUID_COPPER",
	"LEAD", "LIQUID_LEAD",
	"GOLD", "AUREATE_DUST", "LIQUID_GOLD",
	"IRON", "LIQUID_IRON", "RUST",
	"MERCURY",
	"RADIUM", "ACTINIUM", "THORIUM",
	"LIGHTNING", "LIGHT", "LIGHT_SAD",
	"BLOOD", "MUSCLE", "BONE", "EPIDERMIS", "INACTIVE_NEURON", "ACTIVE_NEURON", "CEREBRUM",
	"CORAL", "DEAD_CORAL", "CORAL_STIMULANT", "CORAL_BRANCH", "CORAL_HUB"
].map((n, i) => [n, i]));

const ELEMENT_COUNT = Object.keys(TYPES).length;

class WorldSave {
	static MAGIC_SAVE_CONSTANT_ELEMENT = 0xcc910831; // indicates elements are stored absolutely
	static MAGIC_SAVE_CONSTANT_RIGIDBODY = 0xfebc1828;
	constructor(grid, rigidbodies) {
		this.grid = grid;
		this.rigidbodies = rigidbodies;
	}
	static instantiateRigidbodies(bodies) {
		for (let i = 0; i < bodies.length; i++) {
			const body = bodies[i];
			const obj = scene.main.addPhysicsElement("obj", 0, 0, true);
			obj.transform.rotation = body.rotation;
			obj.scripts.add(DYNAMIC_OBJECT, body.grid, body.upperLeft, Vector2.origin);

		}
	}
	static getRigidbodies() {
		return scene.main.getElementsWithScript(DYNAMIC_OBJECT)
			.map(obj => {
				const l = obj.scripts.DYNAMIC_OBJECT;
				return {
					rotation: obj.transform.rotation,
					grid: l.grid.map(cell => cell.get()),
					upperLeft: Vector2.floor(obj.transform.localSpaceToGlobalSpace(l.centerOfMass.inverse).over(CELL)).get()
				};
			});
	}
	toByteBuffer(buffer = new ByteBuffer()) {
		buffer.write.uint32(WorldSave.MAGIC_SAVE_CONSTANT_RIGIDBODY);
		buffer.write.object(TYPES);
		buffer.write.uint32(this.grid.length);
		buffer.write.uint32(this.grid[0].length);

		let lId, lActs, lReference;
		let duration = 0;

		const writeBlock = () => {
			if (duration) {
				buffer.write.uint16(duration);
				buffer.write.uint8(lId);
				if (lId) {
					buffer.write.uint8(lReference);
					buffer.write.int32(lActs);
				}
			}
		};

		for (let i = 0; i < this.grid.length; i++) {
			for (let j = 0; j < this.grid[0].length; j++) {
				const { id, reference, acts } = this.grid[i][j];
				if (lId !== id || lReference !== reference || lActs !== acts || duration === 0xFFFF) {
					writeBlock();
					lId = id;
					lReference = reference;
					lActs = acts;
					duration = 1;
				} else duration++;
			}
		}

		writeBlock();

		const dyn = this.rigidbodies;

		buffer.write.uint32(dyn.length);
	
		for (let i = 0; i < dyn.length; i++) {
			const obj = dyn[i];
			buffer.write.float64(obj.rotation);
			obj.upperLeft.toByteBuffer(buffer);
			buffer.write.uint32(obj.grid.length);
			buffer.write.uint32(obj.grid[0].length);
			for (let i = 0; i < obj.grid.length; i++) for (let j = 0; j < obj.grid[0].length; j++) {
				const cell = obj.grid[i][j];
				buffer.write.uint8(cell.id);
				if (cell.id) {
					buffer.write.uint8(cell.reference);
					buffer.write.uint32(cell.acts);
				}
			}
		}

		return buffer;
	}
	static fromByteBuffer(buffer) {
		let initial = buffer.read.uint32();
		let width = initial;
		let encodedTypes = TYPES;
		if (
			initial === WorldSave.MAGIC_SAVE_CONSTANT_ELEMENT ||
			initial === WorldSave.MAGIC_SAVE_CONSTANT_RIGIDBODY
		) {
			encodedTypes = buffer.read.object();
			width = buffer.read.uint32();
		}
		const height = buffer.read.uint32();

		const idMap = [];
		for (const element in encodedTypes)
			idMap[encodedTypes[element]] = TYPES[element];

		const save = new WorldSave(
			Array.dim(width, height)
				.map(() => new Cell(TYPES.AIR)),
			[]
		);

		let totalCells = 0;
		let x = 0, y = 0;

		while (totalCells < width * height) {
			const duration = buffer.read.uint16();
			totalCells += duration;
			const id = buffer.read.uint8();
			if (id) {
				const reference = buffer.read.uint8();
				const acts = buffer.read.int32();
				for (let i = 0; i < duration; i++) {
					const cell = save.grid[x][y];
					cell.id = idMap[id];
					cell.reference = reference;
					cell.acts = acts;

					y++;
					if (y === height) {
						y = 0;
						x++;
					}
				}
			} else {
				y += duration;
				x += ~~(y / height);
				y %= height;
				continue;
			}

		}

		if (initial === WorldSave.MAGIC_SAVE_CONSTANT_RIGIDBODY) {
			const rigidbodyCount = buffer.read.uint32();
			for (let i = 0; i < rigidbodyCount; i++) {
				const obj = {};
				obj.rotation = buffer.read.float64();
				obj.upperLeft = Vector2.fromByteBuffer(buffer);
				obj.grid = Array.dim(buffer.read.uint32(), buffer.read.uint32())
					.map(() => new Cell(TYPES.AIR));
				for (let i = 0; i < obj.grid.length; i++) for (let j = 0; j < obj.grid[0].length; j++) {
					const cell = obj.grid[i][j];
					cell.id = buffer.read.uint8();
					if (cell.id) {
						cell.reference = buffer.read.uint8();
						cell.acts = buffer.read.uint32();
					}
				}
				save.rigidbodies.push(obj);
			}
		}

		return save;
	}
}

const SAVE_FILE_PATH = "world.sand";

fileSystem.createFileType(WorldSave, ["sand"]);

class Cell {
	constructor(id) {
		this.id = id;
		this.updated = false;
		this.vel = new Vector2(0, 0);
		// delete this.vel.x;
		// delete this.vel.y;
		// let _x = 0, _y = 0;
		// Object.defineProperties(this.vel, {
		// 	x: {
		// 		get: () => _x,
		// 		set: a => _x = a
		// 	},
		// 	y: {
		// 		get: () => _y,
		// 		set: a => {
		// 			if (this.id === TYPES.SMOKE && a) debugger;
		// 			_y = a;
		// 		}
		// 	}
		// });
		this.acts = 0;
		this.reference = 0;
	}
	get(result = new Cell()) {
		result.id = this.id;
		result.reference = this.reference;
		result.acts = this.acts;
		result.vel.set(this.vel);
		return result;
	}
	sameType(cell) {
		if (cell.id !== this.id) return false;
		if (DATA[cell.id].reference && cell.reference !== this.reference) return false;
		return true;
	}
}

const CELL = 3;

const grid = Array.dim(width / CELL, height / CELL)
	.map(() => new Cell(TYPES.AIR));

const WIDTH = grid.length;
const HEIGHT = grid[0].length;

class DYNAMIC_OBJECT extends ElementScript {
	static RES = 2;
	static SKIP = 20;
	static DISTRIBUTION = 8;
	static nextSlot = 0;
	init(obj, grid, upperLeft, textureOffset) {
		obj.scripts.removeDefault();
		this.rb = obj.scripts.PHYSICS;
		this.colors = new Map();
		this.textureOffset = textureOffset ?? upperLeft.get();
		obj.transform.position = upperLeft.times(CELL);
		this.centerOfMass = Vector2.origin;
		this.setGrid(grid, Vector2.origin);
		this.slot = (DYNAMIC_OBJECT.nextSlot++) % DYNAMIC_OBJECT.DISTRIBUTION;
		this.collidingObjects = new Map();
	}
	static computeCenterOfMass(grid) {
		const centerOfMass = Vector2.origin;
		let total = 0;
		for (let i = 0; i < grid.length; i++) for (let j = 0; j < grid[0].length; j++) {
			if (grid[i][j].id) {
				total++;
				centerOfMass.x += i;
				centerOfMass.y += j;
			}
		}
		return centerOfMass.mul(CELL / total);
	}
	collideGeneral(obj, { element }) {
		if (!this.collidingObjects.has(element)) {
			this.collidingObjects.set(element);
			synth.play({
				duration: 10,
				frequency: Random.range(600, 800),
				volume: 0.3,
				wave: "sine",
				fadeOut: 100
			});
		}
	}
	setGrid(obj, grid, gridOffset) {
		this.grid = grid;

		obj.transform.position = obj.transform.localSpaceToGlobalSpace(this.centerOfMass.inverse);
		this.centerOfMass = DYNAMIC_OBJECT.computeCenterOfMass(this.grid);
		obj.transform.position = obj.transform.localSpaceToGlobalSpace(this.centerOfMass.plus(gridOffset));

		this.width = this.grid.length;
		this.height = this.grid[0].length;
		this.gridBounds = new Rect(-this.centerOfMass.x, -this.centerOfMass.y, this.width * CELL, this.height * CELL);
		this.smallGrid = Array.dim(
			Math.ceil(this.width / DYNAMIC_OBJECT.RES),
			Math.ceil(this.height / DYNAMIC_OBJECT.RES)
		).fill(false);
		this.skipGrid = Array.dim(
			Math.floor(this.width / DYNAMIC_OBJECT.SKIP),
			Math.floor(this.height / DYNAMIC_OBJECT.SKIP)
		).map((_, x, y) => {
			x *= DYNAMIC_OBJECT.SKIP;
			y *= DYNAMIC_OBJECT.SKIP;
			for (let i = 0; i < DYNAMIC_OBJECT.SKIP; i++)
			for (let j = 0; j < DYNAMIC_OBJECT.SKIP; j++) {
				if (this.grid[x + i][y + j].id)
					return false;
			}
			return true;
		});

		for (let i = 0; i < this.width; i++) for (let j = 0; j < this.height; j++) {
			const cell = this.grid[i][j];
			if (cell.id && !this.colors.has(cell))
				this.colors.set(cell, DATA[cell.id].getColor(
					this.textureOffset.x + i,
					this.textureOffset.y + j
				).get());
		}
	}
	explode(obj, ox, oy, r, vel) {
		if (!obj.defaultShape) return;
		const v = new Vector2(ox, oy).times(CELL);
		const closest = obj.getModel("default").closestPointTo(v);
		const diff = closest.minus(v);
		if (diff.mag > r * CELL) return;
		this.rb.applyImpulseMass(closest, diff.times(vel));
	}
	forEachCell(obj, fn) {
		const { grid, skipGrid } = this;
		const { SKIP } = DYNAMIC_OBJECT;

		const gridBounds = this.gridBounds
			.getModel(obj.transform)
			.scaleAbout(Vector2.origin, 1 / CELL);
		const bounds = gridBounds.getBoundingBox();
		const globalMin = new Vector2(0, 0);
		const globalMax = new Vector2(WIDTH - 1, HEIGHT - 1);
		const min = Vector2.clamp(Vector2.floor(bounds.min), globalMin, globalMax);
		const max = Vector2.clamp(Vector2.ceil(bounds.max), globalMin, globalMax);
		const c = new Vector2(0, 0);
		const local = new Vector2(0, 0);
		const toLocal = Matrix3.mulMatrices([
			Matrix3.scale(1 / CELL),
			Matrix3.translation(this.centerOfMass),
			obj.transform.inverse,
			Matrix3.scale(CELL)
		]);
		
		const localDY = new Vector2(toLocal.m01, toLocal.m11);

		// border precomputing
		const edges = gridBounds
			.getEdges()
			.sort((a, b) => a.middle.y - b.middle.y);
	
		let topEdgeLeft = edges[0];
		let topEdgeRight = edges[1];
		if (topEdgeRight.middle.x < topEdgeLeft.middle.x)
			[topEdgeLeft, topEdgeRight] = [topEdgeRight, topEdgeLeft];
	
		let bottomEdgeLeft = edges[2];
		let bottomEdgeRight = edges[3];
		if (bottomEdgeRight.middle.x < bottomEdgeLeft.middle.x)
			[bottomEdgeLeft, bottomEdgeRight] = [bottomEdgeRight, bottomEdgeLeft];
	
		const topCutoff = topEdgeLeft.b.x;
		const bottomCutoff = bottomEdgeLeft.a.x;
	
		let top = topEdgeLeft;
		let bottom = bottomEdgeLeft;
	
		// skip grid precomputing
		const angle = Geometry.normalizeAngle(obj.transform.rotation);
		const skipRadius = SKIP * Math.SQRT1_2;
		const modAngle = Math.PI / 4 + (angle % (Math.PI / 2));
		const offAngle = Math.PI / 4 + angle;
		const vertexOffsetX = (Math.cos(modAngle) + Math.cos(offAngle)) * skipRadius;
		const vertexOffsetY = (Math.sin(modAngle) + Math.sin(offAngle)) * skipRadius;
		const leftSkipSlope = Math.tan((angle % (Math.PI / 2)));
		const rightSkipSlope = Math.tan((angle % (Math.PI / 2)) + Math.PI / 2);
		const skipToVertex = Matrix3.mulMatrices([
			Matrix3.translation(vertexOffsetX, vertexOffsetY),
			toLocal.inverse,
			Matrix3.scale(SKIP)
		]);
		const skip = new Vector2(0, 0);
		const vertex = new Vector2(0, 0);
	
		for (c.x = min.x; c.x <= max.x; c.x++) {
			if (c.x > topCutoff) top = topEdgeRight;
			if (c.x > bottomCutoff) bottom = bottomEdgeRight;
			const minY = Math.max(Math.ceil(top.evaluate(c.x)), min.y);
			const maxY = Math.min(Math.ceil(bottom.evaluate(c.x)) - 1, max.y);
			c.y = minY;
			toLocal.times(c, local);
			for (; c.y <= maxY; c.y++) {
				local.add(localDY);
				const lx = Math.floor(local.x);
				const ly = Math.floor(local.y);
				const cell = grid[lx]?.[ly];
				if (cell?.id) fn(cell, c.x, c.y);
				else {
					skip.x = Math.floor(lx / SKIP);
					skip.y = Math.floor(ly / SKIP);
					if (skipGrid[skip.x]?.[skip.y]) {
						skipToVertex.times(skip, vertex);
						const slope = c.x > vertex.x ? rightSkipSlope : leftSkipSlope;
						const intersectY = (c.x - vertex.x) * slope + vertex.y;
						c.y = Math.floor(intersectY);
					}
				}
			}
		}

		// const iCell = 1 / CELL;
		// const bounds = this.gridBounds
		// 	.getModel(obj.transform)
		// 	.scaleAbout(Vector2.origin, iCell)
		// 	.getBoundingBox();
		// const boundsMin = new Vector2(0, 0);
		// const boundsMax = new Vector2(WIDTH - 1, HEIGHT - 1);
		// const min = Vector2.clamp(Vector2.floor(bounds.min), boundsMin, boundsMax);
		// const max = Vector2.clamp(Vector2.ceil(bounds.max), boundsMin, boundsMax);
		// const toLocal = Matrix3.mulMatrices([
		// 	Matrix3.translation(this.centerOfMass.x * iCell, this.centerOfMass.y * iCell),
		// 	Matrix3.scale(iCell, iCell),
		// 	obj.transform.inverse,
		// 	Matrix3.scale(CELL, CELL)
		// ]);
		// const c = new Vector2(0, 0);
		// const local = new Vector2(0, 0);
		// for (c.x = min.x; c.x <= max.x; c.x++) {
		// 	for (c.y = min.y; c.y <= max.y; c.y++) {
		// 		toLocal.times(c, local);
		// 		let { x, y } = local;
		// 		if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
		// 			const cell = this.grid[~~x][~~y];
		// 			if (cell.id) fn(cell, c.x, c.y);
		// 		}
		// 	}
		// }
	}
	removeIfNecessary(obj) {
		if ((obj.defaultShape && !obj.getBoundingBox().intersect(new Rect(0, 0, width, height))) || isNaN(obj.transform.position)) {
			obj.remove();
			return true;
		}
		return false;
	}
	inject(obj) {
		if ((obj.defaultShape && !obj.getBoundingBox().intersect(new Rect(0, 0, width, height))) || isNaN(obj.transform.position)) {
			obj.remove();
			return;
		}
		
		this.forEachCell((cell, x, y) => {
			const c = grid[x][y];
			if (c.id && !STATIC_SOLID.has(c.id))
				createParticle(new Vector2(x, y), new Vector2(Random.range(-1, 1), Random.range(-1, 1)));
			cell.get(c);
			Element.updateCell(x, y);
		});
	}
	extract(obj) {
		this.forEachCell((cell, x, y) => {
			if (grid[x][y].sameType(cell)) {
				Element.die(x, y);
				tex.shaderSetPixel(x, y, this.colors.get(cell));
			} else cell.id = TYPES.AIR;
		});
		tex.loaded = false;

		const { defaultShape } = obj;

		for (let i = 0; i < this.width; i += DYNAMIC_OBJECT.RES)
		for (let j = 0; j < this.height; j += DYNAMIC_OBJECT.RES) {
			const sx = ~~(i / DYNAMIC_OBJECT.RES);
			const sy = ~~(j / DYNAMIC_OBJECT.RES);
			this.smallGrid[sx][sy] = this.grid[i][j].id !== TYPES.AIR;
		}

		const extractSubGrid = shape => {
			const bounds = shape.getBoundingBox();

			const grid = Array.dim(
				Math.ceil(1 + bounds.width) * DYNAMIC_OBJECT.RES,
				Math.ceil(1 + bounds.height) * DYNAMIC_OBJECT.RES
			).map(() => new Cell(TYPES.AIR));

			let {
				xRange: { min: minX, max: maxX },
				yRange: { min: minY, max: maxY }
			} = bounds;
			minX = Math.floor(minX);
			minY = Math.floor(minY);
			maxX = Math.ceil(maxX) + 1;
			maxY = Math.ceil(maxY) + 1;

			const edges = shape.getEdges()
				.filter(edge => edge.a.x !== edge.b.x);

			
			for (let i = minX; i <= maxX; i++) {
				const stops = edges
					.filter(edge => edge.a.x > edge.b.x ? edge.b.x <= i && i < edge.a.x : edge.a.x <= i && i < edge.b.x)
					.map(edge => edge.a.y === edge.b.y ? edge.a.y : edge.evaluate(i))
					.sort((a, b) => a - b);
	
				for (let n = 0; n < stops.length; n += 2) {
					const startY = Math.floor(stops[n]) - 1;
					const endY = Math.ceil(stops[n + 1]);
					for (let j = startY; j <= endY; j++) {
						for (let ii = 0; ii < DYNAMIC_OBJECT.RES; ii++)
						for (let jj = 0; jj < DYNAMIC_OBJECT.RES; jj++) {
							const x = i * DYNAMIC_OBJECT.RES + ii;
							const y = j * DYNAMIC_OBJECT.RES + jj;
							if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
								grid[x - minX * DYNAMIC_OBJECT.RES][y - minY * DYNAMIC_OBJECT.RES] = this.grid[x][y];
								this.grid[x][y] = new Cell(TYPES.AIR);
							}
						}
					}
				}
			}

			return grid;
		};

		const shapes = Geometry.gridToExactPolygons(this.smallGrid, 1)
			.filter(shape => shape.area > 2 ** 2)
			.map(shape => Geometry.simplify(shape, 0.5))
			.sort((a, b) => a.area - b.area);
		
		if (!shapes.length) {
			obj.remove();
			return;
		}

		const inflateDist = CELL;//Math.SQRT2 * CELL;

		if (shapes.length === 1 && intervals.frameCount % DYNAMIC_OBJECT.DISTRIBUTION !== this.slot) {
			const newCenterOfMass = DYNAMIC_OBJECT.computeCenterOfMass(this.grid);
			obj.transform.position = obj.transform.localSpaceToGlobalSpace(newCenterOfMass.minus(this.centerOfMass));
		
			this.centerOfMass = newCenterOfMass;
			this.gridBounds.x = -this.centerOfMass.x;
			this.gridBounds.y = -this.centerOfMass.y;

			const newShape = Geometry.inflate(
				shapes[0]
					.scaleAbout(Vector2.origin, CELL * DYNAMIC_OBJECT.RES)
					.move(this.centerOfMass.inverse),
				inflateDist
			);

			let shouldReplace = !defaultShape;
			if (!shouldReplace)
				shouldReplace = newShape.vertices.length !== defaultShape.vertices.length;
			if (!shouldReplace) {
				const totalDist = newShape.vertices
					.map((v, i) => Vector2.sqrDist(v, defaultShape.vertices[i]))
					.reduce((a, b) => a + b, 0);
				shouldReplace = totalDist > 1;
			}

			if (shouldReplace)
				obj.defaultShape = newShape;
		} else for (let i = 0; i < shapes.length; i++) {
			let shape = shapes[i];
			const subgrid = extractSubGrid(shape);
			shape = shape
				.scaleAbout(Vector2.origin, CELL * DYNAMIC_OBJECT.RES);
			
			const gridOffset = shape.getBoundingBox().min;
			shape = Geometry.inflate(shape, inflateDist);

			if (i === shapes.length - 1) { // guarentee other things have been placed before moving
				this.setGrid(subgrid, gridOffset);
				obj.defaultShape = shape.move(this.centerOfMass.plus(gridOffset).inverse);
			} else {
				const obj2 = scene.main.addPhysicsElement("obj", 0, 0, true);
				obj2.transform.rotation = obj.transform.rotation;
				const pos = Vector2.floor(obj.transform.localSpaceToGlobalSpace(gridOffset.minus(this.centerOfMass)).over(CELL));
				obj2.scripts.add(
					DYNAMIC_OBJECT, subgrid, pos, this.textureOffset.plus(Vector2.floor(gridOffset.over(CELL)))
				);
				obj2.defaultShape = shape.move(obj2.scripts.DYNAMIC_OBJECT.centerOfMass.plus(gridOffset).inverse);
			}
		}
		
	}
	update(obj) {
		const { rb } = this;
		rb.mobile = !paused;
		for (const [key, count] of this.collidingObjects)
			this.collidingObjects.set(key, count - 1);
	}
	draw(obj, name, shape) {
		if (keyboard.pressed("c")) {
			renderer.stroke(Color.RED).infer(shape);
			renderer.draw(Color.RED).circle(0, 0, CELL);
			renderer.stroke(new Color(255, 255, 0, 0.5), CELL).rect(this.gridBounds);
		}
		// renderer.drawThrough(obj.transform, () => {
		// 	renderer.image(this.tex).rect(this.gridBounds);
		// });
	}
	escapeDraw(obj) {
		// this.forEachCell((cell, x, y) => {
		// 	console.log(x, y);
		// 	renderer.draw(Color.BLUE).circle(x * CELL, y * CELL, CELL / 2);
		// });
	}
}

class CHUNK_COLLIDER extends ElementScript {
	static RES = 3;
	static MIN_FILL_PERCENT = 0.05;
	static MIN_SHAPE_AREA_PERCENT = 0.03;
	static DISTRIBUTION = 4;
	static nextSlot = 0;
	static isSolid(cell) {
		if (cell.id === TYPES.ELECTRICITY) return SOLID.has(cell.reference);
		return SOLID.has(cell.id) && !cell.vel.sqrMag;
	}
	init(obj, pos, chunk) {
		obj.scripts.removeDefault();
		this.offset = pos.times(CHUNK);
		this.size = ~~(CHUNK / CHUNK_COLLIDER.RES);
		this.grid = Array.dim(this.size, this.size).fill(false);
		this.chunk = chunk;
		this.area = this.size ** 2;
		this.slot = (CHUNK_COLLIDER.nextSlot++) % CHUNK_COLLIDER.DISTRIBUTION;
		this.shouldUpdate = false;
		obj.mouseEvents = false;
	}
	remesh(obj) {
		this.shouldUpdate = false;

		let solid = 0;
		for (let i = 0; i < this.size; i++)
		for (let j = 0; j < this.size; j++) {
			const x = this.offset.x + i * CHUNK_COLLIDER.RES;
			const y = this.offset.y + j * CHUNK_COLLIDER.RES;
			if (!Element.inBounds(x, y)) continue;
			const cell = grid[x][y];
			const isSolid = CHUNK_COLLIDER.isSolid(cell);
			this.grid[i][j] = isSolid;
			if (isSolid) solid++;
		}

		obj.removeAllShapes();

		if (solid < this.area * CHUNK_COLLIDER.MIN_FILL_PERCENT) return;

		const shapes = Geometry.gridToExactPolygons(this.grid, CELL * CHUNK_COLLIDER.RES);
		for (let i = 0; i < shapes.length; i++) {
			const shape = shapes[i];
			if (shape.area < CHUNK_COLLIDER.MIN_SHAPE_AREA_PERCENT * this.area * (CHUNK_COLLIDER.RES * CELL) ** 2)
				continue;
			obj.addShape(String(i), Geometry.joinEdges(shape, 0.5));
		}
	}
	update(obj) {
		this.shouldUpdate ||= !this.chunk.sleep;
		if (!this.shouldUpdate)
			return;
		if (intervals.frameCount % CHUNK_COLLIDER.DISTRIBUTION !== this.slot)
			return;
		
		this.remesh();
	}
	draw(obj, name, shape) {
		if (keyboard.pressed("c")) renderer.stroke(Color.CYAN, 2).infer(shape);
	}
}

{ // walls
	const floor = scene.main.addPhysicsRectElement("floor", width / 2, height + 50, width + 200, 100, false, new Controls("w", "s", "a", "d"), "No Tag");
	const ceiling = scene.main.addPhysicsRectElement("ceiling", width / 2, -50, width + 200, 100, false, new Controls("w", "s", "a", "d"), "No Tag");
	const leftWall = scene.main.addPhysicsRectElement("leftWall", -50, height / 2, 100, height, false, new Controls("w", "s", "a", "d"), "No Tag");
	const rightWall = scene.main.addPhysicsRectElement("rightWall", width + 50, height / 2, 100, height, false, new Controls("w", "s", "a", "d"), "No Tag");
};

// intervals.continuous(time => {
// 	if (keyboard.pressed("Control") && mouse.justPressed("Left") && STATIC_SOLID.has(brush)) {
// 		const obj = scene.main.addPhysicsElement("obj", 0, 0, true, new Controls("w", "s", "a", "d"), "No Tag");
// 		const radius = Math.ceil(Random.range(10, 20));
// 		const grid = Array.dim(radius * 2 + 1, radius * 2 + 1);
// 		for (let i = -radius; i <= radius; i++) {
// 			for (let j = -radius; j <= radius; j++) {
// 				grid[i + radius][j + radius] = new Cell(i ** 2 + j ** 2 < radius ** 2 ? brush : TYPES.AIR);
// 			}
// 		}
// 		obj.scripts.add(DYNAMIC_OBJECT, grid, Vector2.floor(mouse.world.over(CELL)).minus(radius));
// 	}
// }, IntervalFunction.AFTER_UPDATE);

class Chunk {
	constructor(x, y) {
		this.x = x;
		this.y = y;
		this.sleep = false;
		this.sleepNext = true;
		this.sceneObject = scene.main.addPhysicsElement("chunk", x * CHUNK * CELL, y * CHUNK * CELL, false);
		this.sceneObject.scripts.add(CHUNK_COLLIDER, new Vector2(x, y), this);
	}
}

const CHUNK = 16;
const chunks = Array.dim(WIDTH / CHUNK, HEIGHT / CHUNK)
	.map((_, x, y) => new Chunk(x, y));

//try{chunks[1] += (new Chunk(20, 20))}catch(e){alert(e)}

const CHUNK_WIDTH = chunks.length;
const CHUNK_HEIGHT = chunks[0].length;

const lastIds = Array.dim(WIDTH, HEIGHT)
	.fill(TYPES.AIR);


class Element {
	static DEFAULT_PASS_THROUGH = new Set([TYPES.AIR]);
	constructor(alpha, color, resistance = 0, flammability = 0, update = () => null, onburn = () => null, reference = false) {
		
		if (typeof resistance === "function")
			this.getResistance = resistance;
		else this.resistance = resistance;

		this.flammability = flammability;
		this.onburn = onburn;

		if (typeof color === "function") {
			this.getColorInternal = color;
		} else {
			this.multipleColors = Array.isArray(color);
			alpha /= 255;
			if (this.multipleColors)
				this.color = color.map(color => Color.alpha(color, alpha));
			else this.color = Color.alpha(color, alpha);
		}
		this.update = update;
		this.reference = reference;

		this.textureCache = !(this.reference || this.color);
		if (this.textureCache) {
			this.tex = new Texture(WIDTH, HEIGHT);
			this.colorCached = Array.dim(WIDTH, HEIGHT);
		}
	}

	getResistance(x, y) {
		return this.resistance;
	}

	getColor(x, y) {
		if (this.textureCache) {
			if (!this.colorCached[x][y]) {
				this.tex.setPixel(x, y, this.getColorInternal(x, y));
				this.colorCached[x][y] = true;
			}
			return this.tex.getPixel(x, y);
		}
		return this.getColorInternal(x, y);
	}

	getColorInternal(x, y) {
		if (this.multipleColors) return Random.choice(this.color);
		return this.color;
	}

	burn(x, y, fireType, burn = false) {
		if (burn || Random.bool(this.flammability)) {
			if (!this.onburn(x, y)) Element.setCell(x, y, fireType);
			else {
				Element.affectNeighbors(x, y, (x, y) => {
					if (Element.isType(x, y, fireType)) Element.setCell(x, y, TYPES.AIR);
				});
			}
		}
	}

	static onLine(x, y, x1, y1, x2, y2){
		if(!(x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2))) return false;

		let N = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))
		let ox;
		let oy;
		for (let step = 0; step <= N; step++) {
			let t = N === 0 ? 0.0 : step / N;
			ox = Math.round(x1 * (1.0 - t) + t * x2);
			oy = Math.round(y1 * (1.0 - t) + t * y2);
			if(x == ox && y == oy) return true;
		}
		return false;
	}

	static inCircle(x, y, x1, y1, r){
		return (Math.sqrt((x-x1)**2 + (y-y1)**2) <= r)
	}

	static onRing(x, y, x1, y1, r){
		return this.inCircle(x, y, x1, y1, r) && !this.inCircle(x, y, x1, y1, r-1)
	}

	static inRect(x, y, x1, y1, x2, y2){
		return (x >= x1 && x <= x2 && y >= y1 && y <= y2);
	}

	static inTriangle(x, y, x1, y1, x2, y2, x3, y3){
		let xMin = Math.min(x1, Math.min(x2, x3));
		let xMax = Math.max(x1, Math.max(x2, x3));
		let yMin = Math.min(y1, Math.min(y2, y3));
		let yMax = Math.max(y1, Math.max(y2, y3));
		if(!(x >= xMin && x <= xMax && y >= yMin && y <= yMax)) return false;

		let N = Math.max(Math.abs(x3 - x2), Math.abs(y3 - y2))
		let ox;
		let oy;
		for (let step = 0; step <= N; step++) {
			let t = N === 0 ? 0.0 : step / N;
			ox = Math.round(x2 * (1.0 - t) + t * x3);
			oy = Math.round(y2 * (1.0 - t) + t * y3);
			if(this.onLine(x, y, x1, y1, ox, oy)) return true;
		}
		return false;
	}

	static inRhombus(x, y, x1, y1, width, height, angle){
		if(!(x >= x1-width/2 && x <= x1+width/2 && y >= y1-height/2 && y <= y1+height/2)) return false;
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		const rotate = (x1, y1, angle) => [Math.cos(angle) * x1 - Math.sin(angle) * y1, Math.sin(angle) * x1 + Math.cos(angle) * y1];
		const points = [
			rotate(-width / 2, -height / 2, angle),
			rotate(width / 2, -height / 2, angle),
			rotate(-width / 2, height / 2, angle),
			rotate(width / 2, height / 2, angle)];
		const minX = Math.floor(Math.min(...points.map(point => point[0])));
		const maxX = Math.round(Math.max(...points.map(point => point[0])));
		const minY = Math.floor(Math.min(...points.map(point => point[1])));
		const maxY = Math.round(Math.max(...points.map(point => point[1])));

		for (let i = minX; i <= maxX; i++) {
			for (let j = minY; j <= maxY; j++) {
				let [ox, oy] = rotate(i, j, -angle);
				ox = Math.abs(ox) / (width / 2);
				oy = Math.abs(oy) / (height / 2);

				if (oy <= 1 - ox)
					if(Math.round(i + x1) == x && Math.round(j + y1) == y) return true;
			}
		}
		return false;
	}

	static getNeighborsOfType(x, y, id) {
		return [
			Element.isType(x, y - 1, id),
			Element.isType(x + 1, y - 1, id),
			Element.isType(x + 1, y, id),
			Element.isType(x + 1, y + 1, id),
			Element.isType(x, y + 1, id),
			Element.isType(x - 1, y + 1, id),
			Element.isType(x - 1, y, id),
			Element.isType(x - 1, y - 1, id)
		];
	}

	static inBounds(x, y) {
		return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
	}

	static react(x, y, reactant, product, chance = 1) {
		let reacted = false;
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (Element.isType(ox, oy, reactant) && Random.bool(chance)) {
				Element.setCell(ox, oy, product);
				reacted = true;
			}
		});
		return reacted;
	}

	static consumeReact(x, y, reactant, product, chance = 1) {
		let reacted = false;
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (!reacted && Element.isType(ox, oy, reactant) && Random.bool(chance)) {
				Element.setCell(x, y, product);
				Element.die(ox, oy);
				reacted = true;
			}
		});
		return reacted;
	}

	static mixReact(x, y, reactant, product, chance = 1) {
		let reacted = false;
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (!reacted && Element.isType(ox, oy, reactant) && Random.bool(chance)) {
				Element.setCell(x, y, product);
				Element.setCell(ox, oy, product);
				reacted = true;
			}
		});
		return reacted;

	}

	static reactMany(x, y, reactant, product, chance = 1) {
		let reacted = false;
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (Element.isTypes(ox, oy, reactant) && Random.bool(chance)) {
				Element.setCell(x, y, product);
				reacted = true;
			}
		});
		return reacted;
	}

	static consumeReactMany(x, y, reactant, product, chance = 1) {
		let reacted = false;
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (!reacted && Element.isTypes(ox, oy, reactant) && Random.bool(chance)) {
				Element.setCell(x, y, product);
				Element.die(ox, oy);
				reacted = true;
			}
		});
		return reacted;
	}

	static mixReactMany(x, y, reactant, product, chance = 1) {
		let reacted = false;
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (!reacted && Element.isTypes(ox, oy, reactant) && Random.bool(chance)) {
				Element.setCell(x, y, product);
				Element.setCell(ox, oy, product);
				reacted = true;
			}
		});
		return reacted;
	}

	static affectAllNeighbors(x, y, effect) {
		for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
			const ox = x + i;
			const oy = y + j;
			if ((i || j) && Element.inBounds(ox, oy))
				effect(ox, oy);
		}
	}

	static affectNeighbors(x, y, effect) {
		for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
			const ox = x + i;
			const oy = y + j;
			if ((i || j) && Element.inBounds(ox, oy) && grid[ox][oy].id !== TYPES.AIR)
				effect(ox, oy);
		}
	}

	static probabilityAffectNeighbors(x, y, effect, range, samples) {
		for (let i = 0; i < samples; i++) {
			const ox = x + Random.int(-range, range);
			const oy = y + Random.int(-range, range);
			if (x !== ox && y !== oy && Element.inBounds(ox, oy) && grid[ox][oy].id !== TYPES.AIR)
				effect(ox, oy);
		}
	}

	static tryBurn(x, y, type) {
		const cell = grid[x][y];
		if (cell.id !== type) {
			const data = DATA[cell.id];
			data.burn(x, y, type);
			if (data.flammability > 0)
				return true;
		}
		return false;
	}

	static trySetCell(x, y, id, passthrough) {
		if (Element.isEmpty(x, y, passthrough)) {
			Element.setCell(x, y, id);
			return true;
		}
		return false;
	}

	static setCellId(x, y, id) {
		const cell = grid[x][y];

		if (DATA[id].reference) {
			const base = DATA[cell.id].reference ? cell.reference : cell.id;
			cell.id = id;
			cell.reference = base;
		} else {
			cell.id = id;
		}
		Element.updateCell(x, y);
	}

	static setCell(x, y, id) {
		const cell = grid[x][y];

		if (DATA[id].reference) {
			const base = DATA[cell.id].reference ? cell.reference : cell.id;
			cell.id = id;
			cell.reference = base === id ? 0 : base;
		} else {
			cell.id = id;
		}
		cell.vel.mul(0);
		cell.acts = 0;
		Element.updateCell(x, y);
	}

	static dereference(x, y) {
		const cell = grid[x][y];
		cell.id = cell.reference;
		cell.reference = 0;
		cell.vel.mul(0);
		cell.acts = 0;
		Element.updateCell(x, y);
	}

	static sleeping(x, y) {
		const cx = ~~(x / CHUNK);
		const cy = ~~(y / CHUNK);
		return chunks[cx][cy].sleep;
	}

	static updateCell(x, y) {
		const S = 1;
		for (let i = -S; i <= S; i += 2) for (let j = -S; j <= S; j += 2) {
			const X = x + i;
			const Y = y + j;
			if (!Element.inBounds(X, Y))
				continue;
			const cx = ~~(X / CHUNK);
			const cy = ~~(Y / CHUNK);
			const chunk = chunks[cx][cy];
			chunk.sleepNext = false;
		}
	}

	static die(x, y) {
		Element.setCell(x, y, TYPES.AIR);
	}

	static isEmptyReference(x, y, set = Element.DEFAULT_PASS_THROUGH) {
		return Element.inBounds(x, y) && set.has(grid[x][y].id);
	}


	static isEmpty(x, y, set = Element.DEFAULT_PASS_THROUGH) {
		if (Element.inBounds(x, y)) {
			let id = grid[x][y].id;
			if (DATA[id].reference) {
				if (set.has(id)) return true;
				id = grid[x][y].reference;
			}
			return set.has(id);
		}
		return false;
	}

	static threeCheck(x, y, element = TYPES.AIR) {
		return Element.isType(x, y, element) &&
			Element.isType(x + 1, y, element) &&
			Element.isType(x - 1, y, element);
	}

	static threeChecks(x, y, elements) {
		return Element.isTypes(x, y, elements) &&
			Element.isTypes(x + 1, y, elements) &&
			Element.isTypes(x - 1, y, elements);
	}


	// [7] [0] [1]
	// [6] [ ] [2]
	// [5] [4] [3]
	// returns true if all neighbors are "element," returns false otherwise
	static check(x, y, element = TYPES.AIR, neighbors = [0]) {
		for (let i = 0; i < neighbors.length; i++) {
			if (neighbors[i] < 0 || neighbors[i] > 7) throw `"${neighbors[i]}" is not an accepted value for the [neighbors] array (must be between 0 and 7, inclusive)`;

			if (neightbors[i] == 0 && !Element.isType(x, y - 1, element)) return false;
			else if (neightbors[i] == 1 && !Element.isType(x + 1, y - 1, element)) return false;
			else if (neightbors[i] == 2 && !Element.isType(x + 1, y, element)) return false;
			else if (neightbors[i] == 3 && !Element.isType(x + 1, y + 1, element)) return false;
			else if (neightbors[i] == 4 && !Element.isType(x, y + 1, element)) return false;
			else if (neightbors[i] == 5 && !Element.isType(x - 1, y + 1, element)) return false;
			else if (neightbors[i] == 6 && !Element.isType(x - 1, y, element)) return false;
			else if (neightbors[i] == 7 && !Element.isType(x - 1, y - 1, element)) return false;
			else throw "ball";
		}

		return true;
	}


	static move(x, y, fx, fy) {
		const t = grid[fx][fy];
		grid[fx][fy] = grid[x][y];
		grid[x][y] = t;
		Element.updateCell(x, y);
		Element.updateCell(fx, fy);
	}

	static isType(x, y, type) {
		return Element.inBounds(x, y) && grid[x][y].id === type;
	}

	static isTypes(x, y, types) {
		return Element.inBounds(x, y) && types.has(grid[x][y].id);
	}

	static permeate(x, y, permeator, permeatee, soaker, violence = 5) {
		try {
			let ox = x;
			let d = 1;

			while (Element.isType(ox, y + d, permeator)) {
				d++;
				let p = Random.perlin(y + d + intervals.frameCount, 0.25, x);
				ox += Math.round(Number.remap(p, 0, 1, -violence, violence));
			}

			if (Element.inBounds(ox, y + d) && Element.isType(ox, y + d, permeatee)) {
				Element.setCell(ox, y + d, permeator);
				if (Element.isType(x, y - 1, soaker)) Element.die(x, y - 1);
				else Element.updateCell(x, y);
			}
		} catch (e) { alert(e + "\n" + e.stack) }
	}

	static tryMove(x, y, fx, fy, passthrough, move = Element.move) {
		return Element.tryMoveReference(x, y, fx, fy, passthrough, move);
		const dx = fx - x;
		const dy = fy - y;
		const len = Math.sqrt(dx * dx + dy * dy);
		let lx = x;
		let ly = y;
		for (let i = 1; i <= len; i++) {
			const t = i / len;
			const nx = Math.round(x + dx * t);
			const ny = Math.round(y + dy * t);
			if (!Element.isEmpty(nx, ny, passthrough)) {
				if (lx !== x || ly !== y) {
					move(x, y, lx, ly);
					return true;
				} else return false;
			}
			lx = nx;
			ly = ny;
		}

		if (Element.isEmpty(fx, fy, passthrough))
			move(x, y, fx, fy);
		else move(x, y, lx, ly);

		return true;
	}

	static tryMoveReference(x, y, fx, fy, passthrough, move = Element.move) {
		const dx = fx - x;
		const dy = fy - y;
		const len = Math.sqrt(dx * dx + dy * dy);
		let lx = x;
		let ly = y;
		for (let i = 1; i <= len; i++) {
			const t = i / len;
			const nx = Math.round(x + dx * t);
			const ny = Math.round(y + dy * t);
			if (!Element.isEmptyReference(nx, ny, passthrough)) {
				if (lx !== x || ly !== y) {
					move(x, y, lx, ly);
					return true;
				} else return false;
			}
			lx = nx;
			ly = ny;
		}

		if (Element.isEmptyReference(fx, fy, passthrough))
			move(x, y, fx, fy);
		else move(x, y, lx, ly);
		return true;
	}
}

const GRAVITY = 0.5 / CELL;
const DISPERSION = 4;

scene.physicsEngine.gravity.y = GRAVITY * CELL;

const GAS = new Set([TYPES.STEAM, TYPES.SMOKE, TYPES.ESTIUM_GAS, TYPES.HYDROGEN, TYPES.DDT, TYPES.INCENSE_SMOKE]);
const LIQUID = new Set([TYPES.WATER, TYPES.LAVA, TYPES.POWER_LAVA, TYPES.BLOOD, TYPES.ESTIUM, TYPES.DECUMAN_GLAZE, TYPES.GLAZE_BASE, TYPES.OIL, TYPES.LIQUID_COPPER, TYPES.LIQUID_IRON, TYPES.LIQUID_LEAD, TYPES.LIQUID_GOLD, TYPES.GENDERFLUID, TYPES.ACID, TYPES.HONEY, TYPES.MOLTEN_WAX, TYPES.SALT_WATER]);
const GAS_PASS_THROUGH = new Set([TYPES.AIR, TYPES.FIRE, TYPES.BLUE_FIRE]);
const LIQUID_PASS_THROUGH = new Set([...GAS_PASS_THROUGH, ...GAS]);
const WATER_PASS_THROUGH = new Set([...LIQUID_PASS_THROUGH, TYPES.OIL, TYPES.ESTIUM]);
const SALT_WATER_SWAP_PASSTHROUGH = new Set([TYPES.WATER]);
const SOLID_PASS_THROUGH = new Set([...LIQUID_PASS_THROUGH, ...LIQUID]);
const SOLID = new Set(Object.values(TYPES));
SOLID.delete(TYPES.PARTICLE);
for (const type of SOLID_PASS_THROUGH)
	SOLID.delete(type);
const PARTICLE_PASSTHROUGH = new Set([...SOLID_PASS_THROUGH, TYPES.PARTICLE]);
const ALL_PASSTHROUGH = new Set(Object.values(TYPES));
const WATER_TYPES = new Set([TYPES.WATER, TYPES.SALT_WATER]);
const GLAZE_TYPES = new Set([TYPES.GLAZE_BASE, TYPES.DECUMAN_GLAZE])
const ANT_UNSTICKABLE = new Set([TYPES.GENDERFLUID, TYPES.COPPER, TYPES.HIGH_EXPLOSIVE, TYPES.LIQUID_COPPER, TYPES.IRON, TYPES.LIQUID_IRON, TYPES.LEAD, TYPES.LIQUID_LEAD, TYPES.ESTIUM_GAS, TYPES.STEEL, TYPES.BRICK, TYPES.MUSCLE, ...WATER_TYPES]);
const CONDUCTIVE = new Set([TYPES.GENDERFLUID, TYPES.LIGHT_SAD, TYPES.COPPER, TYPES.GOLD, TYPES.AUREATE_DUST, TYPES.LIQUID_GOLD, TYPES.HIGH_EXPLOSIVE, TYPES.LIQUID_COPPER, TYPES.LEAD, TYPES.LIQUID_LEAD, TYPES.ESTIUM_GAS, TYPES.STEEL, TYPES.BRICK, TYPES.IRON, TYPES.MUSCLE, ...WATER_TYPES]);
const ELECTRICITY_PASSTHROUGH = new Set([...CONDUCTIVE, TYPES.ELECTRICITY]);
const SUGARY = new Set([TYPES.SUGAR, TYPES.HONEY]);
const COLD = new Set([...WATER_TYPES, TYPES.ICE, TYPES.BLOOD, TYPES.ESTIUM, TYPES.HONEY]);
const SOIL_TYPES = new Set([TYPES.DAMP_SOIL, TYPES.SOIL]);
const GRASS_ROOTABLE = new Set([...SOIL_TYPES, ...WATER_TYPES]);
const CONVEYOR_RESISTANT = new Set([TYPES.CONVEYOR_LEFT, TYPES.CONVEYOR_RIGHT, TYPES.CONDENSED_STONE]);
const RADIATION_RESISTANT = new Set([TYPES.AIR, TYPES.RADIUM, TYPES.ACTINIUM, TYPES.THORIUM, TYPES.LEAD, TYPES.LIQUID_LEAD, TYPES.CONDENSED_STONE]);
const NEURON = new Set([TYPES.INACTIVE_NEURON, TYPES.ACTIVE_NEURON])
const BRAIN = new Set([...NEURON, TYPES.CEREBRUM])
const MEATY = new Set([...BRAIN, TYPES.EPIDERMIS, TYPES.MUSCLE, TYPES.BLOOD, TYPES.BONE])
const THICKETS = new Set([TYPES.THICKET, TYPES.INCENSE, TYPES.THICKET_BUD, TYPES.THICKET_SEED, TYPES.INCENSE_SMOKE, TYPES.THICKET_STEM]);
const ACID_IMMUNE = new Set([TYPES.ACID, TYPES.GLASS]);

function updatePixel(x, y) {
	tex.setPixel(x, y, DATA[grid[x][y].id].getColor(x, y));
}

class Particle {
	constructor(position, velocity) {
		this.cell = grid[position.x][position.y].get();
		this.velocity = velocity ?? this.cell.vel.get();
		this.cell.vel.mul(0);
		Element.die(position.x, position.y);
		this.position = position;
		this.color = DATA[this.cell.id].getColor(position.x, position.y).get();
		this.lastPosition = this.position.get();
		this.submerged = false;
	}
	remove() {
		updatePixel(Math.floor(this.lastPosition.x), Math.floor(this.lastPosition.y));
		updatePixel(Math.floor(this.position.x), Math.floor(this.position.y));
	}
	solidify() {
		const { x, y } = Vector2.floor(this.position);
		this.cell.get(grid[x][y]);
		Element.updateCell(x, y);
	}
	move(blocked, onBlocked, onAir) {
		// const f = Vector2.floor(this.position.plus(this.velocity));

		// if (blocked(f.x, f.y)) {
			const { mag } = this.velocity;
			const dir = this.velocity.over(mag);
			for (let i = 0; i < mag + 1; i++) {
				this.position.add(dir);
				let fx = Math.floor(this.position.x);
				let fy = Math.floor(this.position.y);
				if (!Element.inBounds(fx, fy) || blocked(fx, fy)) {
					this.position.sub(dir);

					if (onBlocked && !blocked(Math.floor(this.position.x), Math.floor(this.position.y)))
						return onBlocked();
					
				} else if (onAir && grid[fx][fy].id === TYPES.AIR)
					return onAir();
			}
		// }
		// this.position.add(this.velocity);
		return false;
	}
	bounce() {
		const scale = 1;
		this.velocity = Vector2.fromAngle(Random.angle()).mul(scale);
	}
	update() {
		this.position.get(this.lastPosition);
		
		const { id } = grid[Math.floor(this.position.x)][Math.floor(this.position.y)];

		if (id === TYPES.AIR) {
			this.velocity.y += GRAVITY;
			if (this.submerged) {
				this.solidify();
				return false;
			}
			if (this.move(
				(x, y) => grid[x][y].id !== TYPES.AIR,
				() => (this.solidify(), true)
			)) return false;
		} else {
			this.submerged = true;
			if (!SOLID.has(id)) {
				if (this.move(
					(x, y) => SOLID.has(grid[x][y].id),
					() => (this.bounce(), false),
					() => (this.solidify(), true)
				)) return false;
			} else {
				if (this.move(
					(x, y) => false,
					() => false,
					() => (this.solidify(), true)
				)) return false;
			}
			
		}

		const { x, y } = Vector2.floor(this.position);
		const cx = Number.clamp(x, 0, WIDTH - 1);
		const cy = Number.clamp(y, 0, HEIGHT - 1);

		if (cx !== x || cy !== y) {
			this.position.x = cx;
			this.position.y = cy;
			
			if (grid[cx][cy].id === TYPES.AIR) {
				this.solidify();
				return false;
			}
			
			this.bounce();
		}

		return true;
	}
	draw() {
		const { x, y } = Vector2.floor(this.position);
		
		updatePixel(Math.floor(this.lastPosition.x), Math.floor(this.lastPosition.y));

		if (grid[x][y].id === TYPES.AIR)
			tex.setPixel(x, y, this.color);//new Color(0, 255, 0, Color.EPSILON));
		// renderer.draw(this.color).rect(Math.floor(this.position.x) * CELL, Math.floor(this.position.y) * CELL, CELL, CELL);
		// renderer.stroke(Color.RED).arrow(Math.floor(this.position.x) * CELL, Math.floor(this.position.y) * CELL, Math.floor(this.position.x + this.velocity.x) * CELL, Math.floor(this.position.y + this.velocity.y) * CELL);
		// renderer.stroke(Color.RED, 1).rect(Math.floor(this.position.x) * CELL, Math.floor(this.position.y) * CELL, CELL, CELL);
	}
}

let particles = [];

function createParticle(position, velocity) {
	particles.push(new Particle(position, velocity));
}

const genderfluidFlag = flag([
	"#FF76A401",
	"#FFFFFF01",
	"#C011D701",
	"#00000001",
	"#2F3CBE01",
]);

const RADIUM_COLORS = freqColoring([
	["#886e9901", 10],
	["#64705001", 30],
	["#80827d10", 30],
	["#c8ccc225", 3]
]);

const fluidUpdate = (x, y, direction, accel, passthrough) => {
	const cell = grid[x][y];
	const { vel } = cell;
	vel.y += accel;

	const dy = direction * (1 + Math.round(vel.y));

	let fell = false;
	let horiz = false;

	if (Element.tryMove(x, y, x, y + dy, passthrough)) {
		fell = true;
	} else {
		if (vel.y > 5) {
			vel.rotate(Random.angle()).div(2);
			createParticle(new Vector2(x, y));
			return;
		}

		const b = Random.bool() ? -1 : 1;
		const disp = Random.range(0, DISPERSION);
		for (let i = -1; i <= 1; i += 2) {
			const dir = vel.x ? Math.sign(vel.x) : i * b;
			vel.x += dir * disp;
			const d = Math.sign(vel.x) * (Math.round(Math.abs(vel.x)) + 1);
			if (Element.tryMove(x, y, x + d, y + dy, passthrough)) {
				fell = true;
				horiz = true;
			} else {
				if (Element.tryMove(x, y, x + d, y, passthrough)) horiz = true;
				else {
					vel.mul(0);
					continue;
				}
			}
			break;
		}
	}

	if (fell) {
		vel.x *= 0.8;
		if (horiz) vel.y *= 0.8;
	} else vel.y = 0;
};

function chaosUpdate(x, y, passthrough) {
	const angle = Random.angle();
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	if (!Element.tryMove(x, y, Math.round(x + cos), Math.round(y + sin), passthrough))
		Element.updateCell(x, y);
}

const boidUpdate = (x, y, maxSpeed = 4, accuracy = 1, passthrough) => { // by val (mostly)
	const cell = grid[x][y];
	const type = cell.id;
	const cellPV = new Vector2(x,y); 

	//variables
	const separationRadius = 10;
	const separation = 2;
	const cohersion = 10; //over some value
	const alignment = 2;
	const jitterRange = 0.1;
	const boundingRange = 25;
	const boundingStrength = 0.003;
	const samplingRange = 30;
	const samplingAmount = 40 * accuracy;


	//rules
	let cohesionV = new Vector2(0, 0); //cohesion
	let separationV = new Vector2(0, 0); //seperation
	let alignmentV = new Vector2(0, 0);	//alignment
	cell.vel.rotate(Random.range(-jitterRange, jitterRange));
	cell.vel.mag += Random.range(-jitterRange, jitterRange);
	let boundingV = new Vector2(0,0); //bounding
	
	//boundary code
	// if (cellPV.x < boundingRange || cellPV.x > WIDTH-boundingRange || cellPV.y < boundingRange || cellPV.y > HEIGHT-boundingRange){
	// 	// cell.vel.rotate(boundingStrength);
	// 	cell.vel.add(new Vector2(WIDTH / 2, HEIGHT / 2).minus(cellPV).times(boundingStrength))
	// }

	let count = 0;
	Element.probabilityAffectNeighbors(x, y, (ox, oy) => {
		if(Element.isType(ox,oy,type)){
			count++;
			const otherBoidPV = new Vector2(ox,oy);
			const otherBoidCell = grid[ox][oy];

			//rule 1, going towards center of flock
			cohesionV = cohesionV.add(otherBoidPV);

			//rule 2, avoid collision with other boids
			if (otherBoidPV.minus(cellPV).mag < separationRadius) {
				separationV.add(cellPV.minus(otherBoidPV));
			}

			//rule 3, try to match velocity of surrounding boids
			alignmentV = alignmentV.add(otherBoidCell.vel);
		}
	}, samplingRange, samplingAmount);
	
	if (count > 0) {
		//position correction
		cohesionV.div(count); 
		cohesionV.sub(cellPV).normalize().div(cohersion); 

		separationV.div(count);
		separationV.div(separation);

		//velocity correction
		alignmentV.div(count);
		alignmentV.sub(cell.vel).div(alignment)
	}

	//to add more rules add the vectors to the sum
	cell.vel.add(Vector2.sum([cohesionV, separationV, alignmentV,boundingV]));
	cell.vel.mag = Number.clamp(cell.vel.mag, 1, maxSpeed);
	// cell.vel.mul(0.95);
	const dx = Math.round(cell.vel.x); 
	const dy = Math.round(cell.vel.y);
	if (!Element.tryMove(x, y, x + dx, y + dy, passthrough)) {
		cell.vel.invert();
		Element.updateCell(x, y);
	}
}


const fireUpdate = (x, y, type, up = true) => {
	let neighbors = 0;
	let burned = 0;
	let oxygen = 0;

	Element.affectAllNeighbors(x, y, (X, Y) => {
		if (Element.isEmpty(X, Y))
			oxygen++;
		else {
			const cell = grid[X][Y];
			if (Element.tryBurn(X, Y, type))
				burned++;
			neighbors++;
		}
	});

	if ((neighbors < 6 && !burned && Random.bool(0.1)) || !oxygen)
		Element.die(x, y);
	else if (!burned && Random.bool(0.5)) {
		if (up) {
			const d = Random.bool() ? -1 : 1;
			if (Element.tryMove(x, y, x + d, y - 1));
			else if (Element.tryMove(x, y, x - d, y - 1));
		}
		if (!burned) Element.die(x, y);
	}

	Element.updateCell(x, y);
};

const lavaUpdate = (x, y, type) => {
	Element.affectAllNeighbors(x, y, (x, y) => {
		Element.tryBurn(x, y, type);
	});
};

const liquidUpdate = (x, y) => {
	fluidUpdate(x, y, 1, GRAVITY, LIQUID_PASS_THROUGH);
};

const gasUpdate = (x, y) => {
	fluidUpdate(x, y, -1, 0, GAS_PASS_THROUGH);
};

const solidUpdate = (x, y, g = GRAVITY, dxShiftChance = 0, tryMove = Element.tryMove) => {
	const { vel } = grid[x][y];
	vel.y += g;
	const dx = Random.bool(dxShiftChance) ? (Random.bool(.5) ? -1 : 1) : 0;
	const dy = 1 + Math.round(vel.y);
	if (tryMove(x, y, x + dx, y + dy, SOLID_PASS_THROUGH));
	else {
		const d = Random.bool() ? -1 : 1;
		if (tryMove(x, y, x - d, y + dy, SOLID_PASS_THROUGH));
		else if (tryMove(x, y, x + d, y + dy, SOLID_PASS_THROUGH));
		else{
			if (vel.y > 4) {
				vel.rotate(Random.angle()).div(5);
				createParticle(new Vector2(x, y));
				return;
			}
			vel.y = 0;
		}
	}
};

function makeCircle(x, y, id, r = 10, chance = 0.2, passthrough = undefined) {
	let ox = x;
	let oy = y;
	for (let i = -r; i <= r; i++) {
		for (let j = -r; j <= r; j++) {
			if (i * i + j * j < r * r) {
				let x = i + ox;
				let y = j + oy;
				if (Element.inBounds(x, y) && Element.isEmpty(x, y, passthrough) && Random.bool(chance))
					Element.setCell(x, y, id);
			}
		}
	}
}

function makeLine(x, y, x1, y1, id, r = 10, chance = 0.2, passthrough = undefined) {
	const minX = Math.min(x, x1) - r;
	const minY = Math.min(y, y1) - r;
	const maxX = Math.max(x, x1) + r;
	const maxY = Math.max(y, y1) + r;
	const line = new Line(x, y, x1, y1);
	for (let i = minX; i <= maxX; i++) for (let j = minY; j <= maxY; j++) {
		const p = new Vector2(i, j);
		if (Element.inBounds(i, j) && line.distanceTo(p) < r) {
			if(id === "explode") explode(i, j, 1)
			else Element.setCell(i, j, id);
		}
	}
}

function weedBranch(x1, y1, x2, y2, id){
	let N = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))
	let ox;
	let oy;
	for (let step = 0; step <= N; step++) {
		let t = N === 0 ? 0.0 : step / N;
		ox = Math.round(x1 * (1.0 - t) + t * x2);
		oy = Math.round(y1 * (1.0 - t) + t * y2);
		if(Element.isEmpty(ox, oy)){
			Element.setCell(ox, oy, id)
			grid[ox][oy].acts = -1;
		}
	}
}


const EXPLOSION_PASSTHROUGH = new Set([...LIQUID_PASS_THROUGH, TYPES.LIGHTNING, TYPES.AIR]);
EXPLOSION_PASSTHROUGH.delete(TYPES.BLUE_FIRE);
EXPLOSION_PASSTHROUGH.delete(TYPES.FIRE);

function explodeLine(x, y, x1, y1, vel, passthrough) {
	const dx = x1 - x;
	const dy = y1 - y;
	const len = Math.sqrt(dx * dx + dy * dy);
	const ilen = Math.ceil(len);
	for (let i = 0; i <= ilen; i++) {
		const t = i / ilen;
		const ox = Math.round(x + dx * t);
		const oy = Math.round(y + dy * t);

		if (!Element.inBounds(ox, oy)) break;

		if (!Element.isEmpty(ox, oy, passthrough)) {
			if (Random.bool(DATA[grid[ox][oy].id].getResistance(ox, oy)))
				break;

			const CHAOS = 10 * (vel);
			createParticle(new Vector2(ox, oy), new Vector2(
				dx * t * vel + Random.range(-CHAOS, CHAOS),
				dy * t * vel + Random.range(-CHAOS, CHAOS)
			));
		}
	}
}

function explode(ox, oy, r = 10, vel = 0.2, passthrough = EXPLOSION_PASSTHROUGH) {
	const c = Math.PI * 2 * r;

	const dyn = scene.main.getElementsWithScript(DYNAMIC_OBJECT);
	for (let i = 0; i < dyn.length; i++)
		dyn[i].scripts.DYNAMIC_OBJECT.explode(ox, oy, r, vel);

	for (let i = 0; i < c; i++) {
		const angle = i / c * Math.PI * 2;
		const x1 = Math.cos(angle) * r + ox;
		const y1 = Math.sin(angle) * r + oy;
		explodeLine(ox, oy, x1, y1, vel, passthrough);
	}
}

function freqColoring(freqs) {
	const coloring = [];
	for (let [color, freq] of freqs) {
		color = new Color(color);
		for (let i = 0; i < freq; i++)
			coloring.push(color);
	}
	return coloring;
}

function quantize(number, steps) {
	return Math.round(number * steps) / steps;
}

function flag(colors) {
	return (x, y) => {
		y = Math.floor(y / 3);
		return Color.alpha(new Color(colors[(y % colors.length + colors.length) % colors.length]), Color.EPSILON);
	};
}


const DATA = {
	[TYPES.AIR]: new Element(0, Color.BLANK),

	[TYPES.TEST]: new Element(1, (x, y) => {
		const angle = Random.perlin2D(x, y, 0.005) * Math.PI * 2;
		const vec = new Vector2(x, y).rotate(angle);
		const mod = (a, b) => (a % b + b) % b;
		return mod(vec.y, 5) < 1 ? Color.alpha(Color.RED, 40 / 255) : new Color(100, 100, 100, Color.EPSILON);

		const vectors = [];
		for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
			const p = Random.perlin2D(x + i, y + j, .1);
			vectors.push(new Vector2(i, j).mul(p));
		}

		const f = Vector2.sum(vectors).times(0.5).plus(0.5);
		return new Color(f.x * 255, f.y * 255, 0, Color.EPSILON);
		// if (f.x < 0 && f.y < 0) return new Color("#FF000001");
		// else if (f.x >= 0 && f.y < 0) return new Color("#00FF0001");
		// else if (f.x < 0 && f.y >= 0) return new Color("#0000FF01");
		// else return new Color("#FFFFFF01")
	}, 0, 0, (x, y) => {
		const v = grid[x][y].vel;
		if (Element.threeChecks(x, y + 1, SOLID_PASS_THROUGH)) {
			const c = Random.range(0, Math.PI);
			v.x = Math.cos(c);
			v.y = Math.sin(c);
		}
		Element.tryMove(x, y, Math.round(x + v.x), Math.round(y + v.y), SOLID_PASS_THROUGH)

	}),

	[TYPES.EXOTHERMIA]: new Element(1, (x, y) => {
		if (y == 0) return new Color("#b5193b");
		else if (y == 1) return new Color("#b52619");
		else if (y == 2) return new Color("#b33b30");
		else if (y == 3) return new Color("#bf5e3b");
		else if (y == 4) return new Color("#c9904b");
		else if (y == 5) return new Color("#cca85c");
		else if (y == 6) return new Color("#e0cc72");
		else if (y == 7) return new Color("#e8e280");
		else if (y == 8) return new Color("#f5f09a");
		else return new Color("#d7f8fa");
	}, 0, 0, (x, y) => {
		Element.die(x, y);
	}),

	[TYPES.BLOOD]: new Element(1, freqColoring([
		["#5c0404", 15],
		["#590404", 12]
	]), 0.4, 0.01, (x, y) => {
		fluidUpdate(x, y, 1, GRAVITY, WATER_PASS_THROUGH);
	}, (x, y) => {
		Element.setCell(x, y, Random.bool(.05) ? TYPES.ASH : Random.bool(.05) ? TYPES.STEAM : TYPES.SMOKE);
		if (Random.bool(.25)) Element.trySetCell(x, y - 1, TYPES.RUST);
		return true;
	}),

	[TYPES.MUSCLE]: new Element(1, (x, y) => {
		const color = new Color("#5c040401");
		const layer = (x, y) => {
			const angle = Math.PI / 2;
			const c = Math.cos(angle);
			const s = Math.sin(angle);
			[x, y] = [x * c - y * s, x * s + y * c];
			y += Random.perlin(x, 5) * 3;
			const p = Random.voronoi2D(x, y, 0.5);
			return Color.colorScale(color, (1 - p) * 0.5 + 0.5);
		};
		return layer(x, y);
	},
		// freqColoring([
		// 	["#5c0404", 30],
		// 	["#660b17", 20],
		// 	["#540c04", 15],
		// 	["#5e0e08", 15]
		// ]),
		0.46, 0.02, (x, y) => {
			Element.react(x, y, TYPES.AIR, TYPES.EPIDERMIS, .8);

			Element.affectNeighbors(x, y, (ox, oy) => {
				if (Element.isType(ox, oy, TYPES.ACTIVE_NEURON)) {
					//if ((Random.bool(Random.perlin2D(x, y, 100) / 200))) 
					Element.react(x, y, TYPES.EPIDERMIS, TYPES.MUSCLE)
				}
			})

			if ((Random.bool(Random.perlin2D(x, y, 100) / 200))) Element.react(x, y, TYPES.EPIDERMIS, TYPES.MUSCLE)
			else if (Element.isType(x, y - 1, TYPES.EPIDERMIS) || Element.isType(x, y + 1, TYPES.EPIDERMIS) || Element.isType(x - 1, y, TYPES.EPIDERMIS) || Element.isType(x + 1, y, TYPES.EPIDERMIS)) Element.updateCell(x, y);
			//Element.updateCell(x, y)


		}, (x, y) => {
			Element.trySetCell(x, y - 1, Random.bool(.6) ? TYPES.BLOOD : Random.bool() ? TYPES.STEAM : TYPES.SMOKE);
			// const fadeOut = 100;
			// synth.play({ duration: 1000, volume: 1, frequency: 1000, wave: "sine", fadeOut });
			// synth.play({ duration: 1000, volume: 1, frequency: 800, wave: "sine", fadeOut });
		}),

	[TYPES.INACTIVE_NEURON]: new Element(3, new Color("#1b1a47"), 0.4, 0.01, (x, y) => {
		let nearbyNeurons = 0;
		let nearbyNeurons1 = 0;
		let moveChoices = [];

		Element.affectNeighbors(x, y, (ox, oy) => {
			if (Element.isTypes(ox, oy, NEURON)) nearbyNeurons++;
			if (Element.isType(ox, oy, TYPES.MUSCLE)) moveChoices.push([ox, oy]);
		})

		let choice;
		if (moveChoices.length > 0) {
			choice = Random.choice(moveChoices);

			Element.affectNeighbors(choice[0], choice[1], (ox, oy) => {
				if (Element.isTypes(ox, oy, NEURON)) nearbyNeurons1++;
			})

			if (Random.bool(.022) && nearbyNeurons < 2 && nearbyNeurons1 == 1) {
				Element.setCell(choice[0], choice[1], TYPES.INACTIVE_NEURON)
			} else Element.updateCell(x, y)

		}
		else Element.updateCell(x, y)
	}, (x, y) => {
		Element.setCell(x, y, TYPES.WATER);
		return true;
	}),

	[TYPES.ACTIVE_NEURON]: new Element(150, new Color("#1b1a47"), 0.4, 0.08, (x, y) => {
		let strength = 2;

		if (grid[x][y].acts == 0 && Element.isType(x, y, TYPES.ACTIVE_NEURON)) Element.react(x, y, TYPES.INACTIVE_NEURON, TYPES.ACTIVE_NEURON);
		if (grid[x][y].acts == strength) Element.setCell(x, y, TYPES.INACTIVE_NEURON);
		grid[x][y].acts++;

		Element.updateCell(x, y);
	}, (x, y) => {
		Element.setCell(x, y, TYPES.STEAM);
		return true;
	}),

	[TYPES.CEREBRUM]: new Element(3, (x, y) => {
		p = Random.voronoi2D(x * .5, y, 0.2);
		if (p < .2) return new Color(Random.bool() ? "#a8324801" : "#ad396601");
		else return new Color(Random.bool() ? "#8f293c01" : "#8c272701")
	}, 0.4, 0.01, (x, y) => {
		Element.react(x, y, TYPES.INACTIVE_NEURON, TYPES.ACTIVE_NEURON, .0002);
		if (Element.consumeReact(x, y, TYPES.AIR, TYPES.BONE)) grid[x][y].acts = (Random.bool(.08) ? 2 : 1);

		Element.affectNeighbors(x, y, (ox, oy) => {
			if (Element.isType(ox, oy, TYPES.BONE) && grid[ox][oy].acts == 2 && Random.bool(.001)) {
				Element.setCell(ox, oy, TYPES.INACTIVE_NEURON);
			}
		})
		Element.updateCell(x, y)
	}, (x, y) => {
		Element.setCell(x, y, TYPES.WATER);
		return true;
	}),

	[TYPES.EPIDERMIS]: new Element(1, new Color("#8f6863"), .47, .03, (x, y) => {
		let m = 0;
		Element.affectNeighbors(x, y, (ox, oy) => {
			if (Element.isTypes(ox, oy, MEATY)) m++;
		})
		if (m > 7) Element.setCell(x, y, TYPES.MUSCLE);
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.6) ? TYPES.BLOOD : Random.bool() ? TYPES.STEAM : TYPES.SMOKE);
	}),

	[TYPES.BONE]: new Element(1, [new Color("#fcf3f2"), new Color("#fce1de")], .7, 0, (x, y) => {
		if (grid[x][y].acts !== 0) {
			let m = 0;
			Element.affectNeighbors(x, y, (ox, oy) => {
				if (Element.isTypes(ox, oy, new Set([TYPES.CEREBRUM, TYPES.BONE]))) m++;
			})
			if (m > 7) Element.setCell(x, y, TYPES.CEREBRUM);

			Element.react(x, y, TYPES.AIR, TYPES.MUSCLE, .01);
		}
	}),

	[TYPES.CORAL]: new Element(1, Color.ORANGE, .2, .1, (x, y) => {
		Element.affectNeighbors(x, y, (ox, oy) => {
			if (Element.isType(ox, oy, TYPES.CORAL_STIMULANT)) grid[x][y].acts = 200;
			if (Element.isType(ox, oy, TYPES.CORAL) && grid[ox][oy].acts > grid[x][y].acts) grid[x][y].acts = grid[ox][oy].acts--;
		})
		if (grid[x][y].acts == 0) Element.setCell(x, y, TYPES.DEAD_CORAL);
		if (grid[x][y].acts !== 0 && Element.isType(x, y, TYPES.CORAL)) Element.react(x, y, TYPES.DEAD_CORAL, TYPES.CORAL);
		grid[x][y].acts--;

		Element.updateCell(x, y)
	}),

	[TYPES.DEAD_CORAL]: new Element(1, Color.GRAY, .2, .1),

	[TYPES.CORAL_BRANCH]: new Element(1, Color.RAZZMATAZZ, .2, .1),

	[TYPES.CORAL_HUB]: new Element(1, Color.MAGENTA, .2, .1, (x, y) => {

	}),

	[TYPES.CORAL_STIMULANT]: new Element(1, Color.LIME, .2, .1, (x, y) => {
		Element.react(x, y, TYPES.DEAD_CORAL, TYPES.CORAL)
		solidUpdate(x, y)
	}),

	[TYPES.ASH]: new Element(1, freqColoring([
		["#7f8482", 10],
		["#787d7a", 5],
		["#8a8d8a", 7],
	]), 0.01, 0, (x, y) => {
		solidUpdate(x, y, 0, .8)
		/*if(Element.isTypes(x, y + 1, LIQUID_PASS_THROUGH)) */
		//else if(Element.isTypes(x, y + 1, SOLID_PASS_THROUGH) && Random.bool(.7)) Element.tryMove(x, y, x + (Random.bool(.5) ? -1 : 1), y);

	}),

	[TYPES.PRIDIUM]: new Element(1, flag([
		0xD8097E,
		0xD8097E,
		0x8C579C,
		0x24468E,
		0x24468E,
		0xFCF434,
		0xFFFFFF,
		0x9C59D1,
		0x2C2C2C,
		0xFF1E26,
		0xFF941E,
		0xFFFF00,
		0x06BD00,
		0x001A98,
		0x760088,
		0x55CDFD,
		0xF6AAB7,
		0xFFFFFF,
		0xF6AAB7,
		0x55CDFD,
		0x000000,
		0xA3A3A3,
		0xFFFFFF,
		0x800080,
	]), 0, 0),

	[TYPES.GENDERFLUID]: new Element(0, genderfluidFlag, 0, 0.001, liquidUpdate, (x, y) => {
		Element.setCell(x, y, TYPES.BEE);
		return true;
	}),

	[TYPES.DDT]: new Element(5, Color.PURPLE, 0, 1, (x, y) => {
		gasUpdate(x, y);
		Element.consumeReact(x, y, TYPES.BEE, TYPES.AIR);
	}),
	[TYPES.MARBLE]: new Element(1, (x, y) => {
		const p = Random.octave(5, Random.perlin2D, x, y, 0.1);
		let color;

		if (p > 0.48 && p < 0.5)
			color = 0xe8dab3;
		else {
			const p2 = Random.octave(5, Random.perlin2D, x, y, 0.1, Random.sampleSeed + 10);
			if (p2 < 0.5) {
				if (p2 > 0.49)
					color = 0xcccccc;
				else if (p2 > 0.4)
					color = 0xdddddd;
			}
		}

		color ??= Random.bool() ? 0xffffff : 0xf7f6f2;

		return Color.alpha(new Color(color), Color.EPSILON);
	}, 0.9),

	[TYPES.CONVEYOR_RIGHT]: new Element(1, (x, y) => {
		if (x % 2 == 0 && y % 2 == 0) return Color.lerp(new Color("#51678a01"), new Color("#6d82a301"), Random.random());
		else return Color.lerp(new Color("#37415201"), new Color("#323c4d01"), Random.random());
	}, .55, 0, (x, y) => {
		if (!Element.isType(x, y - 1, TYPES.AIR) && !Element.isTypes(x, y - 1, CONVEYOR_RESISTANT)) {
			if (!Element.tryMove(x, y - 1, x + 1, y - 1)) {
				Element.tryMove(x, y - 1, x + 1, y - 2);
			}
		}
	}, (x, y) => {
		Element.setCell(x, y, TYPES.LIQUID_LEAD);
		return true;
	}),

	[TYPES.CONVEYOR_LEFT]: new Element(1, (x, y) => {
		if (x % 2 == 0 && y % 2 == 0) return Color.lerp(new Color("#8a516401"), new Color("#a36d7d01"), Random.random());
		else return Color.lerp(new Color("#52373e01"), new Color("#4d323701"), Random.random());
	}, .55, 0, (x, y) => {
		if (!Element.isType(x, y - 1, TYPES.AIR) && !Element.isTypes(x, y - 1, CONVEYOR_RESISTANT)) {
			if (!Element.tryMove(x, y - 1, x - 1, y - 1)) {
				Element.tryMove(x, y - 1, x - 1, y - 2);
			}
		}
	}, (x, y) => {
		Element.setCell(x, y, TYPES.LIQUID_LEAD);
		return true;
	}),

	[TYPES.BATTERY]: new Element(1, (x, y) => {
		const W = 5;
		const H = W << 1;
		const ix = Math.floor(x / W);
		const iy = Math.floor(y / H);
		x += (iy % 2 ? W >> 1 : 0);
		const gx = x % W;
		let gy = y % H;
		if (Math.floor(x / W) % 2) gy = H - 1 - gy;

		const depth = Math.sqrt((W / 2) ** 2 - (gx - W / 2) ** 2) / (W / 2);

		let color = Color.GRAY;

		if (gy < (H - 1) * 0.1) color = Color.RED;
		if (gy > (H - 1) * 0.9) color = Color.ORANGE;

		return new Color(color.red * depth, color.green * depth, color.blue * depth, Color.EPSILON);

		// let c1 = Color.lerp(new Color("#FF000001"), new Color("#FF000055"), Random.perlin2D(x, y, .01));
		// let c2 = Color.alpha(Color.BLACK, Color.EPSILON);
		// return (x % 2 && y % 2) ? c1 : c2;
	}, 0.65, 0, (x, y) => {
		Element.reactMany(x, y, CONDUCTIVE, TYPES.ELECTRICITY);
		Element.react(x, y, TYPES.ACID, TYPES.ACID)
	}),

	[TYPES.EXPLOSIVE_DUST]: new Element(1, freqColoring([
		["#e87c64", 30],
		["#e38671", 20],
		["#db755e", 30],
		["#e8674a", 1],
	]), .1, .8, solidUpdate, (x, y) => {
		if (Random.bool(.6)) Random.bool() ? makeCircle(x, y, TYPES.FIRE, Random.int(3, 7)) : makeCircle(x, y, TYPES.SMOKE, Random.int(2, 5));
		if (Random.bool(.15)) explode(x, y, Random.int(15, 40));
	}),

	[TYPES.EXPLOSIVE]: new Element(1, (x, y) => {
		const s2 = Random.sampleSeed + 100;
		const f = 3;

		const t1 = Random.perlin(x + y, f);
		const t2 = Random.perlin(x - y, f, s2);

		const t1a = Random.perlin(x + (y + 1), f);
		const t1b = Random.perlin(x + (y - 1), f);
		const t1c = Random.perlin((x + 1) + y, f);
		const t1d = Random.perlin((x - 1) + y, f);

		const t2a = Random.perlin(x - (y + 1), f, s2);
		const t2b = Random.perlin(x - (y - 1), f, s2);
		const t2c = Random.perlin((x + 1) - y, f, s2);
		const t2d = Random.perlin((x - 1) - y, f, s2);

		const d = .77;

		if (t1 > d && ((t1a > d || t1b > d) && (t1c > d || t1d > d)) || t2 > d && ((t2a > d || t2b > d) && (t2c > d || t2d > d))) {
			return Random.bool() ? new Color("#26252601") : new Color("#2f2c3001");
		}

		return Random.choice(freqColoring([
			["#b8372e01", 30],
			["#ab281f01", 30],
			["#94282101", 20],
			["#c74e4601", 1]
		]));

	}, .99, .6, (x, y) => {

	}, (x, y) => {
		if (Random.bool(.008)) Random.bool() ? makeCircle(x, y, TYPES.FIRE, Random.int(25, 40)) : makeCircle(x, y, TYPES.SMOKE, Random.int(10, 30));
		if (Random.bool(.15)) explode(x, y, Random.int(15, 40));
	}),

	[TYPES.HIGH_EXPLOSIVE]: new Element(1, (x, y) => {
		const mod = (a, b) => (a % b + b) % b;
		if (mod(x + y, 30) <= 1 || mod(x - y, 30) <= 1) {
			return Random.bool() ? new Color("#46454601") : new Color("#1a191a01");
		}

		return Random.choice(freqColoring([
			["#eba7eb01", 20],
			["#d199d101", 20],
			["#ad7fad01", 1]
		]));

	}, .98, 0.1, (x, y) => {
		Element.affectNeighbors(x, y, (xN, yN) => {
			if (Element.isType(xN, yN, TYPES.ELECTRICITY) ||
				Element.isType(xN, yN, TYPES.BLUE_FIRE) ||
				Element.isType(xN, yN, TYPES.POWER_LAVA) ||
				Element.isType(xN, yN, TYPES.LIGHTNING)) {
				if (Random.bool(.004)) {
					if (Random.bool())
						makeCircle(x, y, Random.bool(.3) ? TYPES.FIRE : TYPES.BLUE_FIRE, Random.int(30, 50))
					else
						makeCircle(x, y, TYPES.SMOKE, Random.int(15, 35));
				}
				if (Random.bool(.2)) explode(x, y, Random.int(20, 45));
			}
		});
	}, (x, y) => {
		Element.affectNeighbors(x, y, (xN, yN) => {
			if (Element.isType(xN, yN, TYPES.ELECTRICITY) ||
				Element.isType(xN, yN, TYPES.BLUE_FIRE) ||
				Element.isType(xN, yN, TYPES.POWER_LAVA) ||
				Element.isType(xN, yN, TYPES.LIGHTNING)) {
				if (Random.bool(.004)) {
					if (Random.bool())
						makeCircle(x, y, Random.bool(.3) ? TYPES.FIRE : TYPES.BLUE_FIRE, Random.int(30, 50));
					else
						makeCircle(x, y, TYPES.SMOKE, Random.int(15, 35));
				}
				if (Random.bool(.2)) explode(x, y, Random.int(20, 45));
			}
		});

		Element.trySetCell(x, y - 1, TYPES.SMOKE)
	}),

	[TYPES.STONE]: new Element(1, (x, y) => {
		const p = Random.octave(35, Random.perlin2D, x, y, .1);
		const p1 = Random.octave(3, Random.perlin2D, x, y, .05);
		//same old stone colors :)
		c = Random.choice(freqColoring([["#79797901", 1], ["#80808001", 1]]));

		if (p > .5 && p < .53 && Random.bool(.85)) c = new Color("#74747401");

		return c;
	}, 0.7),

	[TYPES.CONDENSED_STONE]: new Element(1, (x, y) => {
		const layer = (x, y) => {
			const angle = Math.PI / 3;
			const c = Math.cos(angle);
			const s = Math.sin(angle);
			[x, y] = [x * c - y * s, x * s + y * c];
			y /= 5;
			y += Random.perlin(x, 5) * 3;
			const p = Random.perlin2D(x, y, 0.1);
			return (p > .5) ? new Color("#3d3c4201") : new Color("#2c2c2e01");
		};
		return Color.avg([layer(x, y), layer(x * 5, y * 5), layer(x * 10, y * 10)]);
		// freqColoring([
	}, 1),

	[TYPES.GLASS]: new Element(.1, [new Color("#7e8d94"), new Color("#838f91")], 0.2),

	[TYPES.SAND]: new Element(1, freqColoring([
		["#d6c692", 45],
		["#decd97", 45],
		["#e0dab9", 1]
	]), 0.3, 0.01, (x, y) => {
		solidUpdate(x, y);
		//place check
		if (
			Element.isTypes(x, y - 1, WATER_TYPES) &&
			!Element.isTypes(x, y + 1, WATER_TYPES) &&
			!Element.isTypes(x - 1, y + 1, WATER_TYPES) &&
			!Element.isTypes(x + 1, y + 1, WATER_TYPES)
		) {
			if (Random.bool(.00002)) {
				//kelp check
				const arr = Element.getNeighborsOfType(x, y, TYPES.KELP);
				const arr2 = Element.getNeighborsOfType(x - 2, y, TYPES.KELP);
				const arr3 = Element.getNeighborsOfType(x + 2, y, TYPES.KELP);

				if (arr
					.map((v, i) => !(v || arr2[i] || arr3[i]))
					.reduce((a, b) => a && b, true)
				) Element.setCell(x, y - 1, TYPES.KELP);
			}
			else Element.updateCell(x, y);
		}
	}, (x, y) => {
		Element.setCell(x, y, TYPES.GLASS);
		return true;
	}),
	[TYPES.SUGAR]: new Element(1, freqColoring([
		["#785d42", 45],
		["#8c6e4f", 45],
		["#ab836f", 1]
	]), 0.2, 0, solidUpdate),

	[TYPES.SALT]: new Element(1, freqColoring([
		["#ded7d5", 45],
		["#e3a594", 45],
		["#edc1b4", 25],
		["#cf7f67", 1]
	]), 0.3, 0, (x, y) => {
		solidUpdate(x, y);
		Element.mixReact(x, y, TYPES.WATER, TYPES.SALT_WATER, 0.1);
	}),
	[TYPES.KELP]: new Element(1, [new Color("#2c6c6b"), new Color("#2b6156"), new Color("#26524a")], 0.12, .02, (x, y) => {
		//see if it is max height
		if (grid[x][y].acts < Random.int(90, 150)) {

			//see if it can happen

			if (
				Element.threeChecks(x, y - 1, WATER_TYPES) &&
				Element.threeChecks(x, y - 2, WATER_TYPES) &&
				Element.isTypes(x + 1, y, WATER_TYPES) &&
				Element.isTypes(x - 1, y, WATER_TYPES) &&
				Element.inBounds(x, y - 1)
			) {
				if (Random.bool(.05)) {

					//maybe it'll happen

					//kelp checks
					if (
						Element.isTypes(x + 2, y - 1, WATER_TYPES) &&
						Element.isTypes(x - 2, y - 1, WATER_TYPES) &&
						Element.isTypes(x + 2, y, WATER_TYPES) &&
						Element.isTypes(x - 2, y, WATER_TYPES)
					) {
						if (Random.bool(.01)) {
							Element.setCell(x - 1, y - 1, TYPES.KELP);
							Element.setCell(x + 1, y - 1, TYPES.KELP);
							grid[x - 1][y - 1].acts = grid[x][y].acts + 1;
							grid[x + 1][y - 1].acts = grid[x][y].acts + 1;
						}
						else if (Random.bool(.05)) {
							let off = Random.bool(.5) ? 1 : -1;
							Element.setCell(x + off, y - 1, TYPES.KELP);
							grid[x + off][y - 1].acts = grid[x][y].acts + 1
						}
						else {
							Element.setCell(x, y - 1, TYPES.KELP);
							grid[x][y - 1].acts = grid[x][y].acts + 1;
						}
					}
					else {
						Element.setCell(x, y - 1, TYPES.KELP);
						grid[x][y - 1].acts = grid[x][y].acts + 1;
					}
				}
				else Element.updateCell(x, y);

			}
		}
		else if (Random.bool(.3) && Element.threeChecks(x, y - 1, WATER_TYPES)) {
			Element.setCell(x, y - 1, TYPES.KELP_TOP);
			grid[x][y - 1].acts = 4;
		}
		else Element.updateCell(x, y);

		if (Random.bool(.00001) && Element.isTypes(x + 1, y, WATER_TYPES) && Element.isTypes(x + 3, y - 3, WATER_TYPES)) {
			Element.setCell(x + 1, y, TYPES.KELP_TOP);
			grid[x + 1][y].acts = 2;
		}
		if (Random.bool(.00001) && Element.isTypes(x - 1, y, WATER_TYPES) && Element.isTypes(x - 3, y - 3, WATER_TYPES)) {
			Element.setCell(x - 1, y, TYPES.KELP_TOP);
			grid[x - 1][y].acts = 3;
		}
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.4) ? (Random.bool(.2) ? TYPES.ASH : TYPES.SMOKE) : TYPES.STEAM);
	}),

	[TYPES.KELP_TOP]: new Element(1, [new Color("#2c6c6b"), new Color("#2b6156"), new Color("#26524a")], 0.12, .02, (x, y) => {
		if (grid[x][y].acts == 4) {
			for (let i = 1; i < 6; i += 2) {
				if (Element.isType(x + 1, y + i, TYPES.WATER) && Element.isType(x - 1, y + i, TYPES.WATER)) {
					Element.setCell(x + 1, y + i, TYPES.PNEUMATOCYST);
					Element.setCell(x - 1, y + i, TYPES.PNEUMATOCYST);
				}
			}

			if (Element.inBounds(x - 2, y - 2) && Element.inBounds(x + 2, y - 2)) {
				Element.setCell(x, y - 1, TYPES.KELP_TOP);
				grid[x][y - 1].acts = 1;
				Element.setCell(x, y - 2, TYPES.KELP_TOP);
				grid[x][y - 2].acts = 1;
				Element.setCell(x + 1, y - 1, TYPES.KELP_TOP);
				grid[x + 1][y - 1].acts = 1;
				Element.setCell(x - 1, y - 1, TYPES.KELP_TOP);
				grid[x - 1][y - 1].acts = 1;
				Element.setCell(x - 2, y, TYPES.KELP_TOP);
				grid[x - 2][y].acts = 1;
				Element.setCell(x + 2, y, TYPES.KELP_TOP);
				grid[x + 2][y].acts = 1;
				Element.setCell(x - 2, y - 2, TYPES.KELP_TOP);
				grid[x - 2][y - 2].acts = 1;
				Element.setCell(x + 2, y - 2, TYPES.KELP_TOP);
				grid[x + 2][y - 2].acts = 1;
			}
			grid[x][y].acts = 1;
		}

		if (grid[x][y].acts == 2) {
			Element.setCell(x + 1, y - 1, TYPES.KELP_TOP);
			grid[x + 1][y].acts = 1;
			Element.setCell(x + 1, y - 2, TYPES.KELP_TOP);
			grid[x + 1][y].acts = 1;
		}

		if (grid[x][y].acts == 3) {
			Element.setCell(x - 1, y - 1, TYPES.KELP_TOP);
			grid[x + 1][y].acts = 1;
			Element.setCell(x - 1, y - 2, TYPES.KELP_TOP);
			grid[x + 1][y].acts = 1;
		}
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.4) ? (Random.bool(.2) ? TYPES.ASH : TYPES.SMOKE) : TYPES.STEAM);
	}),

	[TYPES.ESTIUM]: new Element(4, new Color("#993150"), .35, .08, (x, y) => {
		liquidUpdate(x, y);
		if (Random.bool(.0001) && Element.isType(x, y - 1, TYPES.AIR)) Element.setCell(x, y, TYPES.ESTIUM_GAS);

		Element.consumeReactMany(x, y, SUGARY, TYPES.COPPER);
		Element.consumeReact(x, y, TYPES.OIL, TYPES.FUSE);
		if (Random.bool()) Element.consumeReactMany(x, y, WATER_TYPES, TYPES.SALT)
		else Element.consumeReactMany(x, y, WATER_TYPES, TYPES.ESTIUM_GAS)
	}, (x, y) => {
		Element.trySetCell(x, y - 1, TYPES.ESTIUM_GAS);
	}),

	[TYPES.ESTIUM_GAS]: new Element(4, [new Color("#f7a8b8")], .6, .09, (x, y) => {
		gasUpdate(x, y);
	}, (x, y) => {
		if (Random.bool(.05) && Element.inBounds(x, y + 1)) Element.setCell(x, y + 1, TYPES.SALT);
	}),

	[TYPES.PNEUMATOCYST]: new Element(70, [new Color("#bff55b")], 0.1, .04, (x, y) => {

	}, (x, y) => {
		Element.trySetCell(x, y - 1, TYPES.HYDROGEN);
	}),

	[TYPES.COAL]: new Element(1, (x, y) => {
		const f = 0.3;
		let p = Random.voronoi2D(x, y - 1, f);
		if (p < .2) return new Color("#212b3301");
		p = Random.voronoi2D(x, y, f);
		if (p < .2) return new Color("#1e283001");
		return new Color(Random.bool() ? "#212b3301" : "#242e3601");
	}, 0.6, 0.15, solidUpdate, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.06) ? TYPES.ASH : TYPES.SMOKE);
	}),

	[TYPES.OIL]: new Element(1, (x, y) => {
		const distortF = 0.1;
		const distortStrength = 30;
		x += distortStrength * Random.perlin2D(x, y, distortF);
		y += distortStrength * Random.perlin2D(x + 1000, y, distortF);
		let t = Math.sin(10 * Random.perlin2D(x, y, 0.05));
		let color;
		color = Color.lerp(
			new Color("#222233"),
			new Color(`hsl(${t * 360}deg, 50%, 10%)`),
			Random.perlin2D(x, y, 0.03) ** 2
		);
		color.alpha = Color.EPSILON;
		return color;
	}, 0.15, 0.2, liquidUpdate, (x, y) => {
		Element.trySetCell(x, y - 1, TYPES.SMOKE);
	}),
	[TYPES.STEAM]: new Element(0, [Color.alpha(Color.LIGHT_GRAY, 0.8), Color.alpha(Color.LIGHT_GRAY, 0.8), new Color("#88989d")], 0, 0, (x, y) => {
		{ // rain
			if (Random.bool(0.0004)) {
				Element.setCell(x, y, TYPES.WATER);
				return;
			}
		};
		{ // lightning
			const CLOUD_RADIUS = 5;
			const CLOUD_STRICTNESS = 0.8;
			const LIGHTNING_DELAY = 30;
			const x1 = x + Random.int(-CLOUD_RADIUS, CLOUD_RADIUS);
			const y1 = y + Random.int(-CLOUD_RADIUS, CLOUD_RADIUS);
			if (Element.isType(x1, y1, TYPES.STEAM)) {
				grid[x][y].acts++;
			}
			if (Random.bool(CLOUD_STRICTNESS)) grid[x][y].acts--;
			if (grid[x][y].acts > LIGHTNING_DELAY && Random.bool(0.000001)) {
				Element.setCell(x, y, TYPES.LIGHTNING);
				return;
			}
		};
		gasUpdate(x, y);
		Element.updateCell(x, y);


	}),

	[TYPES.ICE]: new Element(1, [new Color("#93baed"), new Color("#a4c3eb"), new Color("#c0d4ed"), new Color("#b0caeb")], 0.5, 0.01, (x, y) => {

	}, (x, y) => {
		Element.setCell(x, y, TYPES.WATER);
		return true;
	}),

	[TYPES.SNOW]: new Element(1, [new Color("#e1e6ed"), new Color("#dfe7f5"), new Color("#d5e0f0")], 0.5, 0.2, (x, y) => {
		let reacted = false;
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (!reacted && Element.isTypes(ox, oy, LIQUID) && Random.bool(0.1)) {
				Element.setCell(x, y, TYPES.STAINED_SNOW);
				grid[x][y].reference = grid[ox][oy].id;
				Element.die(ox, oy);
				reacted = true;
			}
		});

		solidUpdate(x, y);
	}, (x, y) => {
		Element.setCell(x, y, TYPES.WATER);
		return true;
	}),

	[TYPES.STAINED_SNOW]: new Element(1, (x, y) => {
		const { reference } = grid[x][y];
		const color1 = reference === TYPES.STAINED_SNOW ? Color.BLANK : DATA[reference].getColor(x, y);
		const color2 = DATA[TYPES.SNOW].getColor(x, y);
		return Color.lerp(color1, color2, 0.5);
	}, 0.5, 0.2, (x, y) => {
		solidUpdate(x, y, GRAVITY, 0);
	}, (x, y) => {
		Element.setCell(x, y, grid[x][y].reference);
		return true;
	}, true),

	[TYPES.STEEL]: new Element(1, (x, y) => {
		let color;

		const angle = Math.PI / 4;
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		[x, y] = [x * c - y * s, x * s + y * c];

		const S = 7;
		let ix = Math.floor(x / S);
		let iy = Math.floor(y / S);
		x += (iy % 2 ? S >> 1 : 0);
		let gx = (x % S + S) % S;
		let gy = (y % S + S) % S;
		ix = Math.floor(x / S);
		iy = Math.floor(y / S);
		if ((ix + iy % 2) % 2)
			[gx, gy] = [gy, gx];

		const a = S / 2;
		const b = S / 8;

		if ((gx - S * 0.5) ** 2 / a ** 2 + (gy - S * 0.5) ** 2 / b ** 2 < 1)
			color = new Color("#82786f");
		else color = Random.bool() ? new Color("#b5a79a") : new Color("#a89c92");



		return Color.alpha(color, Color.EPSILON);
	}, 0.9),

	[TYPES.LIQUID_COPPER]: new Element(20, [new Color("#a35a33"), new Color("#915129")], .65, 0, (x, y) => {

		if (!Element.consumeReactMany(x, y, COLD, TYPES.COPPER))
			liquidUpdate(x, y);

		lavaUpdate(x, y, TYPES.FIRE);
	}),

	[TYPES.COPPER]: new Element(10, (x, y) => {
		let t = Random.perlin(x + y + (Random.bool(.96) ? 0 : 1));
		if (t > .5) {
			return new Color("#944a3405");
		}
		else if (t > .45) return new Color("#752b1505")
		else if (t > .04) return new Color("#823d1e05");
		else return new Color("#d4683505");
	}, 0.7, 0.001, solidUpdate, (x, y) => {
		Element.setCell(x, y, TYPES.LIQUID_COPPER);
		return true;
	}),

	[TYPES.LEAD]: new Element(1, (x, y) => {
		let p = Random.voronoi2D(x, y - 1, 0.2);
		if (p < .2) return new Color("#50406301");
		p = Random.voronoi2D(x, y, 0.2);
		if (p < .2) return new Color("#e2dce822");
		return new Color(Random.bool() ? "#33284001" : "#392e4501");
	}, 0.65, 0.005, () => null, (x, y) => {
		Element.setCell(x, y, TYPES.LIQUID_LEAD);
		return true;
	}),

	[TYPES.LIQUID_LEAD]: new Element(50, [new Color("#453e4d"), new Color("#3e3647")], 0.6, 0, (x, y) => {
		if (!Element.consumeReactMany(x, y, COLD, TYPES.LEAD))
			liquidUpdate(x, y);
		lavaUpdate(x, y, TYPES.FIRE);
	}),

	[TYPES.GOLD]: new Element(1, (x, y) => {


		y *= .1;
		x *= .1;
		y += Random.sampleSeed;
		let yt = y % 1;

		if (yt < 0) yt++;
		//yt = Interpolation.smooth(yt);
		y = ~~y;
		x = ~~x;

		const top = Random.seedRand(x + y * 2000);
		const bottom = Random.seedRand(x + (y + 1) * 2000);

		return Color.lerp(new Color("#edc96706"), new Color("#d4af3706"), top * (1 - yt) + bottom * yt);
		//return new Color("#ffff0001");
	}, 0.6, 0.001, () => null, (x, y) => {
		Element.setCell(x, y, TYPES.LIQUID_GOLD);
		return true;
	}),

	[TYPES.AUREATE_DUST]: new Element(5, (x, y) => {
		return new Color(Random.choice(["#d4af3706", "#d4af3706", "#d4af3706", "#d4af3706", "#d4af3706", "#d4af3706", "#d4af3706", "#d4af3706", "#d4af3706", "#d4af3706", "#d4af3706", "#d4af3706", "#d4af3706", "#d4af3706", "#d4af3706", "#d4af3700"]));
	}, 0.1, 0.002, solidUpdate, (x, y) => {
		Element.setCell(x, y, TYPES.LIQUID_GOLD);
		return true;
	}),

	[TYPES.LIQUID_GOLD]: new Element(50, (x, y) => {
		let t = Random.perlin(x + .2 * y);
		if (t > .5) return new Color("#ad853e1d");
		else if (t > .1) return new Color("#916c341d");
		else return new Color("#edc9672d");
	}, 0.55, 0, (x, y) => {
		if (!Element.consumeReactMany(x, y, COLD, TYPES.GOLD))
			liquidUpdate(x, y);
		lavaUpdate(x, y, TYPES.FIRE);
	}),

	[TYPES.IRON]: new Element(1, (x, y) => {
		const angle = Math.PI * .9
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		[x, y] = [x * c - y * s, x * s + y * c];
		x *= 12;
		y *= 12;
		y /= 5;
		y += Random.perlin(x, 5) * 3;
		let p = Random.perlin2D(x, y, 0.1);
		if (p > .7) return new Color("#a7a9a901");
		p = Random.perlin2D(x - 12, y - 1, 0.1);
		if (p > .7) return new Color("#c9caca01");
		else return new Color(Random.bool(.5) ? "#7f818201" : "#8e909001");
	}, 0.85, 0.0005, (x, y) => {
		// Element.affectNeighbors(x, y, (x1, y1) => {
		// 	if (Element.isTypes(x1, y1, WATER_TYPES)) Element.setCell(x, y, TYPES.RUST);
		// });
		Element.consumeReactMany(x, y, WATER_TYPES, TYPES.RUST);
	}, (x, y) => {
		Element.setCell(x, y, TYPES.LIQUID_IRON);
		return true;
	}),

	[TYPES.LIQUID_IRON]: new Element(30, [new Color("#cc5546"), new Color("#dd4536")], 0.8, 0, (x, y) => {
		if (!Element.consumeReactMany(x, y, COLD, TYPES.IRON))
			liquidUpdate(x, y);
		lavaUpdate(x, y, TYPES.FIRE);
	}),

	[TYPES.RUST]: new Element(1, [new Color("#782907"), new Color("#802a05")], .3, 0, solidUpdate),

	[TYPES.MERCURY]: new Element(2, new Color("#949BA1"), .65, 0, (x, y) => {
		Element.consumeReact(x, y, TYPES.STONE, Random.bool(.9) ? TYPES.SAND : TYPES.AUREATE_DUST, .05);

		liquidUpdate(x, y)
	}),

	[TYPES.BAHHUM]: new Element(1, (x, y) => {
		let th = Number.remap(Random.perlin2D(x, y, .03), 0, 1, 0.1, 0.4);
		let p = Random.voronoi2D(x, y, 0.2);
		if (p < th - 0.1) return new Color("#a8f0bb11");
		//p = Random.voronoi2D(x, y, 0.2);
		//if (p < th) return new Color("#c2d4b201");
		return new Color(Random.bool() ? "#74917801" : "#5b785f01");
		// let p = Math.round(Random.voronoi2D(x, y, .08) * 7)/7;

		//if(p < .0) return new Color("#a8f0bb01")
		//else return new Color("#de9e1d01")
		// return Color.lerp(new Color("#a8f0bb01"), new Color("#d1f0d900"), p)

	}, 0.1, 0.3, (x, y) => {
		if ((Random.bool(Math.max(Random.perlin2D(x, y, .03), 0.01)))) {
			if (Element.react(x, y, TYPES.AIR, TYPES.BAHHUM)) {
				if (Random.bool(0.005)) synth.play({
					duration: 10,
					frequency: Random.range(300, 500),
					volume: 1,
					wave: "sine",
					fadeOut: 10
				});
			}
		} else if (Element.isType(x, y - 1, TYPES.AIR) || Element.isType(x, y + 1, TYPES.AIR) || Element.isType(x - 1, y, TYPES.AIR) || Element.isType(x + 1, y, TYPES.AIR)) Element.updateCell(x, y);

		Element.consumeReact(x, y, TYPES.DDT, TYPES.LIGHTNING)
	}),

	[TYPES.WAX]: new Element(1, [new Color("#f3e3c2"), new Color("#f3e3c2"), new Color("#f0e0c0"), new Color("#f5e7cb")], 0.06, 0.05, (x, y) => {

	}, (x, y) => {
		Element.setCell(x, y, TYPES.MOLTEN_WAX);
		return true;
	}),

	[TYPES.GRAINY_WAX]: new Element(1, [new Color("#f3e3c2"), new Color("#f3e3c2"), new Color("#f7eedc"), new Color("#f5e7cb"), new Color("#f5e7cb")], 0.05, 0.06, (x, y) => {
		solidUpdate(x, y);
		let arr = Element.getNeighborsOfType(x, y, TYPES.GRAINY_WAX);
		if (arr[0] && arr[2] && arr[4] && arr[6] && Random.bool(.2)) Element.setCell(x, y, TYPES.WAX);
		if (Random.bool(.0005)) Element.setCell(x, y, TYPES.WAX);
	}, (x, y) => {
		Element.setCell(x, y, TYPES.MOLTEN_WAX);
		return true;
	}),

	[TYPES.MOLTEN_WAX]: new Element(2, [new Color("#f7eedc"), new Color("#f5e7cb"), new Color("#f5e7cb")], 0.04, 0, (x, y) => {
		liquidUpdate(x, y);
		if (Random.bool(.001)) Element.setCell(x, y, TYPES.GRAINY_WAX);
		else Element.updateCell(x, y);
	}),

	[TYPES.SMOKE]: new Element(.5, [Color.DARK_GRAY, new Color("#232326")], 0, 0, (x, y) => {
		gasUpdate(x, y);
	}),

	[TYPES.HYDROGEN]: new Element(0, [new Color("#55cdfc"), new Color("#47add6")], 0, .5, (x, y) => {
		gasUpdate(x, y);
	}, (x, y) => {
		if (Random.bool(.03)) {
			Element.setCell(x, y, TYPES.WATER);
			return true;
		}
	}),

	[TYPES.SOIL]: new Element(1, freqColoring([
		["#926829", 30],
		["#9b7653", 30],
		["#555555", 1]
	]), 0.3, 0, (x, y) => {
		solidUpdate(x, y);
		Element.consumeReact(x, y, TYPES.WATER, TYPES.DAMP_SOIL);
	}),

	[TYPES.ROOT]: new Element(1, [new Color("#bfb19b"), new Color("#baac99"), new Color("#d6c09f")], 0.15, .02, (x, y) => {
		if (grid[x][y].acts != 1) {
			let ox = x;

			let p = Random.perlin(y + 1, 0.25, x);
			ox += Math.round(Number.remap(p, 0, 1, -1, 1));


			if (Random.bool(.1) && Element.inBounds(ox, y + 1) && (Element.isType(ox, y + 1, TYPES.SOIL) || Element.isType(ox, y + 1, TYPES.DAMP_SOIL))) {
				grid[x][y].acts = 1;
				Element.setCell(ox, y + 1, TYPES.ROOT);
			}
			else Element.updateCell(x, y);

			if (Random.bool(.08)) grid[x][y].acts = 1;
		}
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.7) ? (Random.bool(.2) ? TYPES.ASH : TYPES.SMOKE) : TYPES.STEAM);
	}),

	[TYPES.THICKET_SEED]: new Element(1, freqColoring([
		["#423322", 9],
		["#291f14", 8],
		["#362a1d", 4],
		["#69543e", 4],
		["#594936", 3],
	]), 0.04, 0.06, (x, y) => {
		solidUpdate(x, y);

		if (Element.isType(x, y + 1, TYPES.DAMP_SOIL) && grid[x][y + 1].acts == 0) {
			Element.setCell(x, y, TYPES.THICKET_STEM);
			let h = Random.int(38, 50);
			grid[x][y].acts = h;
		}
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.4) ? TYPES.ASH : TYPES.SMOKE);
	}),

	[TYPES.THICKET_STEM]: new Element(1, freqColoring([
		["#614a57", 3],
		["#4d593d", 7],
		["#4a523a", 10],
		["#434d36", 7],

	]), .15, .03, (x, y) => {
		Element.trySetCell(x, y + 1, TYPES.ROOT, SOIL_TYPES);

		if (grid[x][y].acts > 1 && (Element.isType(x, y - 1, TYPES.AIR) || Element.isType(x, y - 1, TYPES.THICKET) || (Element.isType(x, y - 1, TYPES.THICKET_STEM) && grid[x][y-1].acts == -1))) {
			if (Random.bool(.07)) {
				Element.setCell(x, y - 1, TYPES.THICKET_STEM);
				grid[x][y - 1].acts = grid[x][y].acts - 1;
			} else Element.updateCell(x, y)
		}

		if(Random.bool(.0008) && grid[x][y].acts > 1){
			let h = grid[x][y].acts;
			grid[x][y].acts = -1;
			if (Element.inBounds(x, y + 1))
				grid[x][y+1].acts = -1;
			let d = Random.bool() ? -1 : 1;
			let a = Random.range(-Math.PI/5, Math.PI/5)
			let ox = Math.ceil(Math.cos(a)*d*(h/3) + Random.range(-4, 10)) + x;
			let oy = Math.ceil(Math.sin(a)*(h/3) + Random.range(-3, 3)) + y;
			weedBranch(x + d, y, ox, oy, TYPES.THICKET_STEM);
			for(let i = -3*Math.PI/4; i < 3*Math.PI/4; i += Math.PI/4){
				let len = 6 / Math.sqrt(Math.abs(i)+1)
				let oox = Math.ceil(Math.cos(a+i)*d*len) + ox;
				let ooy = Math.ceil(Math.sin(a+i)*len) + oy;
				weedBranch(ox, oy, oox, ooy, TYPES.THICKET)
			}	
		}

		if(grid[x][y].acts == 1){
			weedBranch(x, y - 1, x, y - 6, TYPES.THICKET_BUD);
			weedBranch(x + (Random.bool() ? 1 : -1), y - 1, x + (Random.bool() ? 1 : -1), y - 5, TYPES.THICKET_BUD);
			weedBranch(x + (Random.bool() ? 1 : -1), y - 1, x + (Random.bool() ? 1 : -1), y - 5, TYPES.THICKET_BUD);
			let ox = Math.ceil(Math.cos(3*Math.PI/2 + Math.PI/5)*5) + x;
			let oy = Math.ceil(Math.sin(3*Math.PI/2 + Math.PI/5)*5) + y;
			weedBranch(x, y, ox, oy, TYPES.THICKET)
			ox = Math.ceil(Math.cos(3*Math.PI/2 - Math.PI/5)*5) + x;
			oy = Math.ceil(Math.sin(3*Math.PI/2 - Math.PI/5)*5) + y;
			weedBranch(x-1, y, ox, oy, TYPES.THICKET)
			grid[x][y].acts--;
		}
		
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.4) ? (Random.bool(.2) ? TYPES.ASH : TYPES.SMOKE) : TYPES.STEAM);
	}),

	[TYPES.THICKET_BUD]: new Element(1, freqColoring([
		["#804e77", 2], 
		["#753f6c", 4], 
		["#7a4d73", 4], 
		["#6b3e64", 2], 
		["#7d5c78", 1]
	]), .15, .03, (x,y) => {
		if(grid[x][y].acts == 0) Element.consumeReact(x, y, TYPES.AIR, TYPES.INCENSE, .01);
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.4) ? (Random.bool(.2) ? TYPES.ASH : TYPES.INCENSE_SMOKE) : TYPES.STEAM);
	}),

	[TYPES.THICKET]: new Element(1, freqColoring([
		["#427a35", 2],
		["#3f7a31", 1],
		["#4a7536", 2],
		["#4a8a3b", 3],
		["#539644", 1]
	]), .15, .03, (x, y)=> null, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.4) ? (Random.bool(.2) ? TYPES.ASH : TYPES.SMOKE) : TYPES.STEAM);
	}),

	[TYPES.INCENSE]: new Element(1, (x, y) => {
		return Random.choice(freqColoring([
			["#57593c01", 2],
			["#5d614001", 3],
			["#73754901", 1],

			["#44613b01", 1],
			["#37472901", 2],
			["#354a2f01", 2],
			["#364d2e01", 3],
		]))
	}, .15, .05, (x, y) => {
		solidUpdate(x, y)
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.1) ? TYPES.ASH : TYPES.INCENSE_SMOKE);
	}),

	[TYPES.INCENSE_SMOKE]: new Element(.6, (x, y) => {
		let p = Random.perlin2D(x, y, .05);
		if(p > .5 && p < .6) return new Color("#0d1e0e01");
		else return new Color("#091c0b01");
	}, 0, 0, (x, y) => {
		gasUpdate(x, y)
	}),


	[TYPES.SUNFLOWER_SEED]: new Element(1, freqColoring([
		["#4d483f", 9],
		["#383632", 8],
		["#6b6452", 5],
		["#a39c8c", 2]
	]), 0.04, 0.06, (x, y) => {
		solidUpdate(x, y);
		if (Element.isType(x, y + 1, TYPES.DAMP_SOIL) && grid[x][y + 1].acts == 0) {
			Element.die(x, y);
			grid[x][y + 1].acts = 5;
		}
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.4) ? TYPES.ASH : TYPES.SMOKE);
	}),

	[TYPES.SUNFLOWER_PETAL]: new Element(1, [new Color("#f5c440"), new Color("#e3c04f"), new Color("#ebd234")], .05, .03, (x, y) => null, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.6) ? (Random.bool(.2) ? TYPES.ASH : TYPES.SMOKE) : TYPES.STEAM);
	}),

	[TYPES.SUNFLOWER_STEM]: new Element(1, [new Color("#2fbd39"), new Color("#57c95f"), new Color("#43ab4a")], .05, 0.03, (x, y) => {
		Element.trySetCell(x, y + 1, TYPES.ROOT, SOIL_TYPES);

		if (grid[x][y].acts > 1 && Element.isType(x, y - 1, TYPES.AIR)) {
			if (Random.bool(.05)) {
				Element.setCell(x, y - 1, TYPES.SUNFLOWER_STEM);
				grid[x][y - 1].acts = grid[x][y].acts - 1;
			} else Element.updateCell(x, y)
		}
		if (grid[x][y].acts == 1) {
			let shift = Random.range(0, Math.PI / 9)
			for (let i = shift; i < 2 * Math.PI + shift; i += Math.PI / 9) {
				const c = Math.cos(i);
				const s = Math.sin(i);
				makeLine(Math.round(c * 6 + x), Math.round(s * 6 + y), Math.round(c * 7 + x), Math.round(s * 7 + y), TYPES.SUNFLOWER_PETAL, 1, 1);
			}
			makeCircle(x, y, TYPES.SUNFLOWER_PETAL, 6, 1)
			makeCircle(x, y, TYPES.SUNFLOWER_SEED, 5, 1, ALL_PASSTHROUGH)

			grid[x][y].acts--;
		}
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.6) ? (Random.bool(.2) ? TYPES.ASH : TYPES.SMOKE) : TYPES.STEAM);
	}),

	[TYPES.DAMP_SOIL]: new Element(1, freqColoring([
		["#34292c", 35],
		["#4f3f32", 35],
		["#666666", 1]
	]), 0.4, 0.01, (x, y) => {
		solidUpdate(x, y)

		const d = Random.bool() ? 1 : -1;
		if (grid[x][y].acts == 5 && Element.threeCheck(x, y - 1, TYPES.AIR) && Element.threeCheck(x + d, y - 1, TYPES.AIR)) {
			if (Random.bool(.03)) {
				Element.setCell(x, y - 1, TYPES.SUNFLOWER_STEM);
				Element.setCell(x + d, y - 1, TYPES.SUNFLOWER_STEM);
				let h = Random.int(45, 60);
				grid[x][y - 1].acts = h;
				grid[x + d][y - 1].acts = h;
			} else Element.updateCell(x, y);
		};

		if (Element.isType(x, y - 1, TYPES.WATER))
			Element.permeate(x, y, TYPES.DAMP_SOIL, TYPES.SOIL, TYPES.WATER, 2);

		if (Element.isType(x, y - 1, TYPES.AIR) && Element.threeCheck(x, y + 1, TYPES.DAMP_SOIL)) {
			if (Random.bool(.0001))
				Element.setCell(x, y - 1, TYPES.GRASS);
			else Element.updateCell(x, y);
		}
	}, (x, y) => {
		Element.setCell(x, y, TYPES.SOIL);
		if (Math.random() < .4) Element.trySetCell(x, y - 1, TYPES.STEAM);
		return true;
	}),

	[TYPES.GRASS]: new Element(1, freqColoring([
		["#53f581", 30],
		["#33d44e", 30],
		["#42e35d", 30],
		["#3fbf55", 1]
	]), 0.05, .03, (x, y) => {
		let shift = Random.bool(.9) ? 0 : Math.floor(Math.random() * 3) - 1;

		if (Element.isType(x, y - 1, TYPES.AIR)) {
			if (Element.isType(x + shift, y - 1, TYPES.AIR) && Element.inBounds(x + shift, y - 1)) {
				if (Random.bool(.001)) {
					Element.setCell(x + shift, y - 1, TYPES.GRASS);
				}
				else if (Random.bool(.0001)) {
					let arr = Element.getNeighborsOfType(x, y - 1, TYPES.AIR);
					if (Element.inBounds(x, y - 1) && arr[0] && arr[2] && arr[6]) {
						Element.setCell(x, y - 1, TYPES.FLOWER);
					}
					else Element.updateCell(x, y);
				}
				else Element.updateCell(x, y);
			}
			else Element.updateCell(x, y)
		}

		if (Element.isType(x, y - 1, TYPES.WATER) || Element.isType(x, y - 1, TYPES.SALT_WATER)) {
			let w = Element.isType(x, y - 1, TYPES.WATER);

			//soak water
			let below = 1;
			while (Element.isType(x, y + below, TYPES.GRASS) && Element.inBounds(x, y + below)) {
				below++;
			}
			if ((w && Random.bool(.05)) || (!w && Random.bool(.005))) {
				if (Element.isType(x, y + below, TYPES.AIR)) Element.setCell(x, y + below, w ? TYPES.WATER : TYPES.SALT);
				else if (Element.isType(x, y + below, TYPES.SOIL)) Element.setCell(x, y + below, TYPES.DAMP_SOIL);
				else if (Element.isType(x, y + below, TYPES.DAMP_SOIL)) Element.permeate(x, y + below, TYPES.DAMP_SOIL, TYPES.SOIL, TYPES.WATER);
				else Element.updateCell(x, y);
			}
			else Element.updateCell(x, y);

			if (Element.isType(x, y + below, TYPES.AIR) || Element.isType(x, y + below, TYPES.SOIL) || Element.isType(x, y + below, TYPES.DAMP_SOIL)) {
				if (Random.bool(.07)) Element.setCell(x, y - 1, TYPES.GRASS);
				else Element.die(x, y - 1);
			} else {
				if (Random.bool(.1)) Element.setCell(x, y - 1, TYPES.GRASS)
				else Element.die(x, y - 1);
			}
		}

		if (Random.bool(.0004)) Element.trySetCell(x, y + 1, TYPES.ROOT, GRASS_ROOTABLE);
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.6) ? (Random.bool(.2) ? TYPES.ASH : TYPES.SMOKE) : TYPES.STEAM);
	}),
	[TYPES.FLOWER]: new Element(5, [Color.RAZZMATAZZ, Color.RAZZMATAZZ, Color.RAZZMATAZZ, Color.RED, Color.SKY_BLUE, Color.CYAN, Color.LAVENDER, Color.MAGENTA, Color.PINK, Color.YELLOW, Color.WHITE, Color.ORANGE], 0.05, .07, (x, y) => {
		let arr = Element.getNeighborsOfType(x, y, TYPES.GRASS)
		if (arr[0] || arr[2] || arr[6]) Element.setCell(x, y, TYPES.GRASS);
	}, (x, y) => {
		if (Element.isEmpty(x, y - 1)) {
			if (Math.random() < .6) Element.trySetCell(x, y - 1, Random.bool(.3) ? TYPES.ASH : TYPES.SMOKE);
			else Element.setCell(x, y - 1, TYPES.STEAM);
		}
	}),
	[TYPES.WATER]: new Element(0, [new Color("#120a59"), new Color("#140960")], 0.4, 0.05, (x, y) => {
		fluidUpdate(x, y, 1, GRAVITY, WATER_PASS_THROUGH);
	}, (x, y) => {
		Element.setCell(x, y, TYPES.STEAM);
		return true;
	}),
	[TYPES.SALT_WATER]: new Element(0, freqColoring([
		["#06253d", 30],
		["#042438", 30]
	]), 0.42, 0.05, (x, y) => {
		fluidUpdate(x, y, 1, GRAVITY, WATER_PASS_THROUGH);
		//if (Random.bool(.5)) {
		const angle = Random.angle();
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		Element.tryMove(x, y, Math.round(x + cos), Math.round(y + sin), SALT_WATER_SWAP_PASSTHROUGH)
		//Element.updateCell(x, y);
		//}
	}, (x, y) => {
		Element.setCell(x, y, TYPES.STEAM);
		Element.trySetCell(x, y - 1, TYPES.SALT);
		return true;
	}),
	[TYPES.POWER_LAVA]: new Element(100, [Color.CYAN, Color.BLUE, Color.SKY_BLUE], 0.7, 0, (x, y) => {
		liquidUpdate(x, y);

		Element.react(x, y - Math.floor((Math.random() * 6)), TYPES.AIR, TYPES.BLUE_FIRE, 0.007);
		Element.reactMany(x, y, WATER_TYPES, TYPES.SMOKE, 0.005);

		if (Random.bool(.5)) Element.react(x, y, TYPES.STONE, TYPES.SMOKE);
		if (Random.bool(.3)) Element.react(x, y, TYPES.GLASS, TYPES.SMOKE);

		Element.affectNeighbors(x, y, (ox, oy) => {
			if (Element.isType(ox, oy, TYPES.AUREATE_DUST)) Random.bool(.6) ? Element.setCell(x, y, TYPES.AUREATE_DUST) : Element.setCell(x, y, TYPES.GOLD);
		})

		lavaUpdate(x, y, TYPES.BLUE_FIRE);
	}),
	[TYPES.LAVA]: new Element(100, [new Color("#bf1000"), new Color("#bf2010")], 0.75, 0, (x, y) => {
		liquidUpdate(x, y);

		lavaUpdate(x, y, TYPES.FIRE);

		if (Random.bool(.0005)) Element.react(x, y - 1, TYPES.AIR, TYPES.FIRE);
		Element.consumeReactMany(x, y, WATER_TYPES, TYPES.STONE);

		if (Element.isType(x, y - 1, TYPES.LIGHTNING)) {
			Element.setCell(x, y, TYPES.POWER_LAVA);
			makeCircle(x, y, TYPES.BLUE_FIRE, 35);
			explode(x, y, 35);
		}

		const arr = Element.getNeighborsOfType(x, y, TYPES.POWER_LAVA);

		for (let i = 0; i < 8; i++) {
			if (arr[i]) {
				Element.setCell(x, y, TYPES.POWER_LAVA);
				if (Element.isType(x, y - 1, TYPES.AIR)) {
					explode(x, y - 1, 10);
				}
				break;
			}
		}

	}),
	[TYPES.FUSE]: new Element(1, freqColoring([
		["#cc2157", 30],
		["#b82352", 30],
		["#d13f6d", 1]
	]), 0.1, 0.2, (x, y) => null, (x, y) => {
		Element.trySetCell(x, y - 1, TYPES.SMOKE);
	}),
	[TYPES.WOOD]: new Element(1, (x, y) => {
		const layer = (x, y) => {
			const angle = Math.PI;
			const c = Math.cos(angle);
			const s = Math.sin(angle);
			[x, y] = [x * c - y * s, x * s + y * c];
			y /= 5;
			y += Random.perlin(x, 5) * 3;
			const p = Random.perlin2D(x, y, 0.1);
			return (p > .5) ? new Color("#2e211701") : new Color("#553C2A01");
		};
		return Color.avg([layer(x * 5, y * 5), layer(x * 10, y * 10), layer(x * 15, y * 15)]);

	}, 0.5, 0.05, () => null, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.1) ? TYPES.ASH : TYPES.SMOKE);
	}),

	[TYPES.HONEY]: new Element(0, [new Color("#996211"), new Color("#8c590d")], 0.7, 0.05, (x, y) => {
		fluidUpdate(x, y, 1, GRAVITY, WATER_PASS_THROUGH);
	}, (x, y) => {
		Element.trySetCell(x, y - 1, TYPES.STEAM);
		Element.setCell(x, y, TYPES.SUGAR);
		return true;
	}),

	[TYPES.HIVE]: new Element(1, (x, y) => {
		const CELL = 6;

		const getHex = uv => {
			uv = uv.get();
			const factor = 1.15;
			uv.y *= factor;

			let gid = Vector2.floor(uv.over(CELL));
			const even = gid.y % 2 === 0;
			if (even) uv.x += CELL * 0.5;
			gid = Vector2.floor(uv.over(CELL));
			let guv = uv.over(CELL).minus(gid);

			const o = guv.get();

			guv = Vector2.abs(guv.minus(0.5)).plus(0.5);

			const slope = Math.tan(3.1415926 / 6.0) * factor;

			const y = slope * (guv.x - 0.5);

			const y2 = y - 0.25 * slope;

			if (guv.y > 1.0 - y) {
				if (guv.y > 1.0 - y2) {
					gid.y += Math.sign(o.y - 0.5);
					if (o.x > 0.5 !== even)
						gid.x += Math.sign(o.x - 0.5);
				}
			}

			const center = gid.plus(0.5).times(CELL);
			if (gid.y % 2 === 0.0) center.x -= CELL * 0.5;
			center.y /= factor;
			return center;
		}

		const uv = new Vector2(x, y);
		const uv2 = getHex(uv);
		const uv3 = getHex(uv.minus(uv2).times(1.2).plus(uv2));
		if (uv2.equals(uv3))
			return Color.lerp(
				new Color("#00000001"),
				new Color("#855a0501"),
				Number.remap(Vector2.dist(uv, uv2) / (CELL / 2), 0, 1, 0.5, 1)
			);
		return Random.choice(freqColoring([
			["#f2be4101", 10],
			["#de9e1d01", 40],
			["#e38c3001", 30]
		]));
	}, 0.3, 0.02, (x, y) => {
		if (Random.bool(.00004)) {
			Element.trySetCell(x, y - 1, TYPES.BEE);
			Element.trySetCell(x - 1, y, TYPES.BEE);
			Element.trySetCell(x + 1, y, TYPES.BEE);
		}

		if (Random.bool(.0005)) Random.bool(.99) ? Element.trySetCell(x, y + 1, TYPES.HONEY) : Element.trySetCell(x, y + 1, TYPES.GRAINY_WAX);

		Element.updateCell(x, y);

	}, (x, y) => {
		if (Random.bool(.7)) Element.trySetCell(x, y - 1, Random.bool(.05) ? TYPES.ASH : TYPES.SMOKE);
		Element.trySetCell(x, y - 1, Random.bool(.3) ? TYPES.MOLTEN_WAX : TYPES.HONEY);
	}),
	[TYPES.BEE]: new Element(2, [
		new Color("#e8d207"), new Color("#ffe812"),
		new Color("#f5e764"), new Color("#e6d42c"),
		new Color("#d1a81f"), new Color("#bd940d")
	], 0.1, 0.05, (x, y) => boidUpdate(x, y, 2, 0.2, LIQUID_PASS_THROUGH), (x, y) => {
		makeCircle(x, y - 1, TYPES.HONEY, 2);
		explode(x, y - 1, 2);
	}),

	[TYPES.ANT]: new Element(2, [new Color("red")], 0.08, 0.05, (x, y) => {

		let dy2 = Random.bool() ? -1 : 1;
		if (Element.isTypes(x - 1, y, ANT_UNSTICKABLE) && Element.isTypes(x + 1, y, ANT_UNSTICKABLE)) {
			const { vel } = grid[x][y];
			vel.y += GRAVITY;
			const dx = Random.bool(.5) ? -1 : 1;
			const dy = 1 + Math.round(vel.y);
			if (Element.tryMove(x, y, x + dx, y + dy, SOLID_PASS_THROUGH));
			else {
				let d = Random.bool() ? -1 : 1;
				if (Element.tryMove(x, y, x + d, y)) { }
				else if (Element.tryMove(x, y, x + d, y - 1)) { }
				else if ((!Element.isType(x - 1, y - dy2, TYPES.AIR) || !Element.isType(x + 1, y - dy2, TYPES.AIR))) Element.tryMove(x, y, x, y - dy2);
				else Element.updateCell(x, y);
				vel.y = 0;
			}
		}
		else if ((!Element.isType(x - 1, y - dy2, ANT_UNSTICKABLE) || !Element.isType(x + 1, y - dy2, ANT_UNSTICKABLE))) Element.tryMove(x, y, x, y - dy2);
		else Element.updateCell(x, y);
	}, (x, y) => {
		makeCircle(x, y - 1, TYPES.SALT, 2);
		explode(x, y - 1, 2);
	}),

	[TYPES.BLUE_FIRE]: new Element(200, [
		Color.CYAN, Color.BLUE, Color.SKY_BLUE, Color.LIME
	], 0, 0, (x, y) => fireUpdate(x, y, TYPES.BLUE_FIRE, false)),
	[TYPES.FIRE]: new Element(140, [new Color("#962a0f"), new Color("#b35e09"), new Color("#c98210"), new Color("#4f1a0a"), new Color("#8a0f04")], 0, 0, (x, y) => fireUpdate(x, y, TYPES.FIRE)),

	[TYPES.ACID]: new Element(30, [Color.LIME, new Color("#2dfc2d")], 0.1, 0, (x, y) => {
		const cell = grid[x][y];
		Element.affectNeighbors(x, y, (x, y) => {
			if (!Element.isTypes(x, y, ACID_IMMUNE) && Random.bool(0.5)) {
				const isStone = Element.isType(x, y, TYPES.CONDENSED_STONE);
				const bool = Random.bool(.0004);
				if (!isStone || (isStone && bool)) {
					Element.setCell(x, y, TYPES.AIR);
					if (Random.bool(0.05)) synth.play({
						duration: 10,
						frequency: Random.range(200, 300),
						fadeOut: 1000,
						wave: "sine",
						volume: 1
					})
					cell.acts++;
				}
				if (isStone && !bool)
					Element.updateCell(x, y);
			}
		});

		if (cell.acts > 2)
			Element.die(x, y);
		else
			liquidUpdate(x, y);
	}),
	[TYPES.ELECTRICITY]: new Element(40, Color.CREAM, (x, y) => {
		return DATA[grid[x][y].reference].getResistance(x, y);
	}, 0, (x, y) => {
		const cell = grid[x][y];

		if (cell.acts === 0) {

			let canConduct = false;
			Element.affectNeighbors(x, y, (x, y) => {
				if (Element.isEmpty(x, y, CONDUCTIVE)) canConduct = true;
				Element.tryBurn(x, y, TYPES.FIRE);
			});

			if (cell.id !== TYPES.ELECTRICITY) return;

			if (!canConduct)
				return Element.dereference(x, y);

			if (!cell.vel.sqrMag) {
				const angle = Random.angle();
				const c = Math.cos(angle);
				const s = Math.sin(angle);
				cell.vel.x = c;
				cell.vel.y = s;
			}

			const l = Random.range(4, 10);
			let blocked = false;
			let lx = x, ly = y;
			const vel = cell.vel.get();
			for (let i = 1; i < l; i++) {
				const ox = x + Math.round(vel.x * i);
				const oy = y + Math.round(vel.y * i);
				if (ox === x && oy === y) continue;

				if (!Element.isEmptyReference(ox, oy, ELECTRICITY_PASSTHROUGH)) {
					blocked = true;
					break;
				}
				if (!Element.isType(ox, oy, TYPES.ELECTRICITY)) {
					Element.setCellId(ox, oy, TYPES.ELECTRICITY);
					grid[ox][oy].acts = 1;
					grid[ox][oy].vel.mul(0);
				}
				lx = ox;
				ly = oy;
			}

			cell.acts = 1;

			grid[lx][ly].acts = 0;
			if (Random.bool(0.8)) grid[lx][ly].vel.mul(0);
			else grid[lx][ly].vel.set(vel);
		} else {
			if (cell.acts++ > 10) {
				Element.dereference(x, y);
			}
		}

		Element.updateCell(x, y);

		// if (Random.bool(0.1)) cell.vel.rotate(Random.range(-1, 1));
		// if (!Element.tryMoveReference(x, y, x + Math.round(cell.vel.x), y + Math.round(cell.vel.y), CONDUCTIVE, (x, y, x1, y1) => {
		// 	Element.dereference(x, y);
		// 	Element.setCellId(x1, y1, TYPES.ELECTRICITY);
		// 	grid[x1][y1].vel.set(cell.vel);
		// })) cell.vel.mul(0);

		// Element.updateCell(x, y);
		// DATA[base].update(x, y);
		// let base = grid[x][y].acts;
		// neighborLoop: for (let i = -1; i <= 1; i += 2)
		// 	for (let j = -1; j <= 1; j += 2) {
		// 		const ox = x + i;
		// 		const oy = y + j;
		// 		if (Element.inBounds(ox, oy) && CONDUCTIVE.has(grid[ox][oy].id)) {
		// 			if (Random.bool(0.25)) {
		// 				Element.setCellId(ox, oy, TYPES.ELECTRICITY);
		// 				break neighborLoop;
		// 			}
		// 		} else if (Element.inBounds(ox, oy) && grid[ox][oy] !== TYPES.AIR) {
		// 			const { id } = grid[ox][oy];
		// 			if (CONDUCTIVE.has(id)) {
		// 				Element.setCellId(ox, oy, TYPES.ELECTRICITY);
		// 			} else DATA[id].burn(ox, oy, TYPES.FIRE);
		// 		}
		// 	}
		// // if (!water && 
		// if (Random.bool(0.5)) {
		// 	Element.setCellId(x, y, base);
		// 	grid[x][y].acts = 0;
		// } else {
		// 	Element.updateCell(x, y);
		// 	DATA[base].update(x, y);
		// }
	}, () => null, true),
	[TYPES.PARTICLE]: new Element(1, (x, y) => {
		return DATA[grid[x][y].reference].getColor(x, y);
	}, 0, 0, (x, y) => {
		let base = grid[x][y].reference;
		const { vel } = grid[x][y];
		vel.y += GRAVITY;

		const fx = x + Math.round(vel.x);
		const fy = y + Math.round(vel.y);

		if (fx === x && fy === y) {
			Element.updateCell(x, y);
			return;
		}

		const dx = fx - x;
		const dy = fy - y;
		const len = Math.sqrt(dx * dx + dy * dy);

		let lx = x;
		let ly = y;
		for (let i = 1; i <= len; i++) {
			const t = i / len;
			const nx = Math.round(x + dx * t);
			const ny = Math.round(y + dy * t);

			if (
				!Element.inBounds(nx, ny) ||
				grid[nx][ny].id === base ||
				!PARTICLE_PASSTHROUGH.has(grid[nx][ny].id)
			) {
				if (lx !== x || ly !== y)
					Element.move(x, y, lx, ly);
				Element.setCell(lx, ly, base);
				return;
			}
			lx = nx;
			ly = ny;
		}

		if (
			Element.inBounds(fx, fy) &&
			grid[fx][fy].id !== base &&
			PARTICLE_PASSTHROUGH.has(grid[fx][fy].id)
		) Element.move(x, y, fx, fy);
		else {
			Element.move(x, y, lx, ly);
			Element.setCell(lx, ly, base);
		}

	}, () => null, true),
	[TYPES.BRICK]: new Element(1, (x, y) => {
		const W = 10;
		const H = W >> 1;
		const ix = Math.floor(x / W);
		const iy = Math.floor(y / H);
		x += (iy % 2 ? W >> 1 : 0);
		const gx = x % W;
		const gy = y % H;

		if (!gx || !gy) return Random.choice(freqColoring([
			["#99827601", 30],
			["#b0988b01", 20],
		]));
		// return new Color(gx / W * 255, gy / H * 255, 0, 1 / 255);
		// if (;
		const color = Random.bool() ? new Color("#7d351101") : new Color("#a3452101");
		return Color.colorScale(
			color,
			Number.remap(
				Random.perlin2D(Math.floor(x / W), Math.floor(y / H)),
				0, 1, 0.5, 1.3
			)
		);
	}, 0.5, 0, (x, y) => {
		Element.consumeReact(x, y, TYPES.GLAZE_BASE, TYPES.TILE_BASE)
		Element.consumeReact(x, y, TYPES.DECUMAN_GLAZE, TYPES.DECUMAN_TILE)

	}),
	[TYPES.CLAY]: new Element(1, [new Color("#9c8b79"), new Color("#a8987d")], 0.4, 0.2, solidUpdate, (x, y) => {
		Element.setCell(x, y, TYPES.BRICK);
		return true;
	}),
	[TYPES.TILE_BASE]: new Element(1, (x, y) => {
		if(x % 20 == 0 || y % 20 == 0) return new Color("#918b8401");
		if(x % 20 == 19 || y % 20 == 1) return new Color("#f2efeb01");
		else return new Color(Random.choice(["#c4bdb701", "#cfc9c401", "#bab1a901"]));
	}, 0.6, 0, (x, y) => {
		if (Element.isType(x, y - 1, TYPES.GLAZE_BASE))
			Element.permeate(x, y, TYPES.TILE_BASE, TYPES.BRICK, TYPES.GLAZE_BASE, 4);
	}),
	[TYPES.DECUMAN_TILE]: new Element(1, (x, y) => {
		if(x % 60 == 0 || y % 60 == 0) return new Color("#26435901");
		if(x % 60 == 59 || y % 60 == 1) return new Color("#6888a101");
		if((x % 60 !== 0 && Math.ceil(x / 60) % 2 == 0) && (y % 60 !== 0 && Math.ceil(y / 60) % 2 == 0)){
			let cx = Math.ceil(x / 60)*60 - 30;
			let cy = Math.ceil(y / 60)*60 - 30;
			let angle = (Math.atan2(cy-y, cx-x) + Math.PI);
			let dist = Math.sqrt((cx-x)**2 + (cy-y)**2);
			if(dist < 3) return new Color("#446a8701") 
			let f = false;
			for(let i = 0; i < Math.PI*2; i += Math.PI/2){
				if (angle >= i && angle <= Math.PI/5 + i){
					f = true;
					return Color.lerp(new Color("#446a8701"), new Color(Random.choice(["#b2c4d101", "#a8b6bf01"])), dist / 30);
				}
			}
			if(!f) return new Color(Random.choice(["#b2c4d101", "#a8b6bf01"]))
		}

		if(x % 15 == 0 || y % 15 == 0) return new Color("#26435901");
		if(x % 15 == 14 || y % 15 == 1) return new Color("#6888a101");
		else return new Color(Random.choice(["#446a8701", "#395a7301", "#385e7a01"]));
	}, 0.6, 0, (x, y) => {
		if (Element.isType(x, y - 1, TYPES.DECUMAN_GLAZE))
			Element.permeate(x, y, TYPES.DECUMAN_TILE, TYPES.BRICK, TYPES.DECUMAN_GLAZE, 4);
	}),
	[TYPES.GLAZE_BASE]: new Element(1, (x, y) => {
		const angle = Random.perlin2D(x, y, 0.0005) * Math.PI * 2;
		const vec = new Vector2(x, y).rotate(angle);
		const mod = (a, b) => (a % b + b) % b;
		return mod(vec.y, 2) < 1 ? new Color("#dfebf501") : new Color(Random.bool() ? "#dce0e301" : "#cfd0d101");
	}, 0.4, 0.05, (x, y) => {
		liquidUpdate(x, y)
		Element.consumeReactMany(x, y, WATER_TYPES, TYPES.DECUMAN_GLAZE);
	}, (x, y) => {
		Element.setCell(x, y, TYPES.SMOKE);
		return true;
	}),
	[TYPES.DECUMAN_GLAZE]: new Element(1, (x, y) => {
		const angle = Random.perlin2D(x, y, 0.005)* Math.PI * 2;
		const vec = new Vector2(x, y).rotate(angle);
		const mod = (a, b) => (a % b + b) % b;
		let c1 = mod(vec.y, 5) < 1 ? new Color("#93afc401") : new Color(Random.bool() ? "#446a8701" : "#2f547001");

		let c2;
		let t = Random.perlin(x - .6 * y + Math.round(Random.range(-2, 2)));
		if (t > .6) c2 = new Color("#446a8701");
		else if (t > .2) c2 = new Color("#2f547001")
		else if (t > .1) c2 = new Color("#c7c5c501");
		else c2 = new Color("#93afc401");

		return Color.lerp(c1, c2, .5);
	}, 0.4, 0.05, (x, y) => {
		liquidUpdate(x, y)
		Element.react(x, y, TYPES.GLAZE_BASE, TYPES.DECUMAN_GLAZE)
	}, (x, y) => {
		Element.setCell(x, y, TYPES.SMOKE);
		return true;
	}),
	[TYPES.RADIUM]: new Element(1, (x, y) => {
		const vx = 1 / Math.SQRT2;
		const vy = 1 / Math.SQRT2;
		const s = vx * x + vy * y;
		x -= vx * s;
		y -= vy * s;
		const f = 2;
		x += s * f;
		y += s * f;
		const noise = Math.sin(20 * Random.perlin2D(x, y, 0.5)) * 0.5 + 0.5;
		const color = RADIUM_COLORS[~~(RADIUM_COLORS.length * noise)];
		return color;
	}, 0.2, 0, (x, y) => {
		solidUpdate(x, y);
		const sd = 20;
		const tx = ~~Random.normalZ(x, sd);
		const ty = ~~Random.normalZ(y, sd);
		if (Element.inBounds(tx, ty) && !Element.isTypes(tx, ty, RADIATION_RESISTANT) && Random.bool(0.15)) {
			const change = Random.bool() ? -1 : 1;
			Element.setCellId(tx, ty, (grid[tx][ty].id + change + ELEMENT_COUNT) % ELEMENT_COUNT);
		} else Element.updateCell(x, y);
	}),

	[TYPES.ACTINIUM]: new Element(1, (x, y) => {
		const p = Random.octave(50, Random.perlin2D, x, y, .1);
		const p1 = Random.octave(3, Random.perlin2D, x, y, .1);
		c = Random.choice(freqColoring([["#a7bac401", 40], ["#97a6ad01", 35]]));

		if (p > .5 && p < .53) c = new Color("#5178ad25");
		else if (p1 < .8 && p1 > .73 && Random.bool(.8)) c = new Color("#8799a101");

		return c;
	}, 0.35, 0, (x, y) => {
		const sd = 40;
		const tx = ~~Random.normalZ(x, sd);
		const ty = ~~Random.normalZ(y, sd);
		if (Element.inBounds(tx, ty) && !Element.isTypes(tx, ty, RADIATION_RESISTANT) && Random.bool(0.11)) {
			Element.setCell(tx, ty, TYPES.AIR);
		} else Element.updateCell(x, y);
	}),

	[TYPES.THORIUM]: new Element(1, (x, y) => {
		const p = Random.octave(35, Random.perlin2D, x, y, .07);
		const p1 = Random.octave(3, Random.perlin2D, x, y, .1);
		c = Random.choice(freqColoring([["#80423601", 2], ["#6b3c2301", 2], ["#753e2e01", 3]]));

		if (p > .5 && p < .55 && Random.bool(.76)) c = new Color("#542e2501");
		else if (p1 < .8 && p1 > .76 && Random.bool(.7)) c = new Color("#8a5d5a01");

		return c;
	}, 0.4, 0, (x, y) => {
		const sd = 15;
		const tx = ~~Random.normalZ(x, sd);
		const ty = ~~Random.normalZ(y, sd);
		if (Element.inBounds(tx, ty) && !Element.isTypes(tx, ty, RADIATION_RESISTANT) && Random.bool(0.3)) {
			Element.tryBurn(tx, ty, TYPES.FIRE)
		} else Element.updateCell(x, y);
	}),

	[TYPES.LIGHTNING]: new Element(80, [new Color(100, 100, 200), Color.WHITE], 0.01, 0, (x, y) => {
		const cell = grid[x][y];
		if (cell.acts === -1) {
			const ox = x + Random.int(-1, 1);
			const oy = y + Random.int(-1, 1);
			if (Random.bool(0.1)) Element.die(x, y);
			else Element.tryMove(x, y, ox, oy);
		} else if (cell.acts === 0) {
			cell.acts++;
			const dx = Random.bool() ? -1 : 1;
			const len = Random.int(5, 10);
			let ox = x;
			for (let i = 0; i < len; i++) {
				ox += Random.bool(0.99) ? -dx : dx;
				const oy = y + i;
				if (Element.trySetCell(ox, oy, TYPES.LIGHTNING, LIQUID_PASS_THROUGH)) {
					if (i < len - 1) {
						grid[ox][oy].acts++;

						if (Random.bool(0.5)) {
							const ox = x + Random.int(-5, 5);
							const oy = y + Random.int(-5, 5);
							if (Element.trySetCell(ox, oy, TYPES.LIGHTNING)) {
								grid[ox][oy].acts--;
							}

						}
					}
				} else {
					if (Element.inBounds(ox, oy)) {
						const { id } = grid[ox][oy];
						if (id !== TYPES.AIR && id !== TYPES.LIGHTNING) {
							if (CONDUCTIVE.has(id)) {
								Element.setCellId(ox, oy, TYPES.ELECTRICITY);
								grid[ox][oy].vel.mul(0);
							} else {
								const data = DATA[id];
								data.burn(ox, oy, TYPES.FIRE, true);
							}
							explode(ox, oy, 15);
						}
					}

					break;
				}
				// else {
				// 	Element.trySetCell(x - dx * i, y + i, TYPES.LIGHTNING);
				// 	Element.trySetCell(x + dx * i, y + i, TYPES.LIGHTNING);
				// }
			}
		} else if (cell.acts++ > 10)
			Element.die(x, y);

		Element.updateCell(x, y);
	}),

	[TYPES.LIGHT_SAD]: new Element(1, new Color(20, 20, 20), 0.9, 0.001, (x, y) => {
		Element.affectNeighbors(x, y, (ox, oy) => {
			if (Element.isTypes(ox, oy, new Set([TYPES.LIGHT, TYPES.CORAL, TYPES.ACTIVE_NEURON, TYPES.ELECTRICITY]))) {
				Element.setCell(x, y, TYPES.LIGHT);
			}
		});
	}, (x, y) => {
		return true;
	}),

	[TYPES.LIGHT]: new Element(255, new Color(255, 200, 100), 0.9, 0.001, (x, y) => {
	
	}, (x, y) => {
		Element.die(x, y);
		makeCircle(x, y, TYPES.LIGHTNING, 10);
		return true;
	}),

};

const STATIC_SOLID = new Set([...SOLID]
	.filter(id => {
		const { update } = DATA[id];
		if (update === solidUpdate) return false;
		if (update.toString().indexOf("solidUpdate") > -1) return false;
		return true;
	})
);

function typeName(type) {
	if (type === TYPES.ELECTRICITY) return "Electricity";
	if (type === TYPES.DDT) return "DDT";
	return Object.entries(TYPES)
		.find(([k, v]) => v === type)[0]
		.split("_")
		.map(word => word
			.toLowerCase()
			.capitalize()
		).join(" ");
}

class TYPE_SELECTOR extends ElementScript {
	static SIZE = 30;
	static FONT = new Font(TYPE_SELECTOR.SIZE * 0.6, "sans-serif", true);
	init(obj, type) {
		obj.scripts.removeDefault();
		this.type = type;
		this.name = typeName(type);
		this.tex = new Texture(Math.ceil(obj.width / CELL), Math.ceil(obj.height / CELL));
		const element = DATA[type];
		this.tex.shader((x, y, dest) => {
			dest.set(element.getColor(x, y));
			dest.alpha = 1;
		});
	}
	click(obj) {
		if (!obj.hidden) brush = this.type;
	}
	update(obj) {
		obj.hidden = !SELECTORS_SHOWN;
	}
	draw(obj, name, shape) {
		renderer.clip().infer(shape);
		renderer.image(this.tex).infer(shape);
		renderer.unclip();
		renderer.textMode = TextMode.CENTER_CENTER;
		const words = this.name.split(" ");

		const symbol = words.length === 1 ? words[0].slice(0, 2) : words.slice(0, 2).map(word => word[0]).join("");
		// text(TYPE_SELECTOR.FONT, symbol[0].toUpperCase() + symbol.slice(1).toLowerCase(), 0, 0);
		const selected = brush === this.type;
		obj.layer = obj.hovered;
		renderer.stroke(selected ? Color.YELLOW : Color.WHITE, selected ? 3 : 1).infer(shape);
		if (obj.hovered || selected) {
			renderer.draw(new Color(255, 255, 255, 0.3)).infer(shape);
			if (obj.hovered) {
				renderer.textMode = TextMode.TOP_CENTER;
				text(Font.Arial20, this.name, 0, obj.height / 2 + 10);
			}
		}
	}
	static create(type, x, y) {
		const button = scene.main.addUIElement("button", x + this.SIZE / 2, y + this.SIZE / 2, this.SIZE, this.SIZE);
		button.scripts.add(TYPE_SELECTOR, type);
		return button;
	}
}

let eTS = 0
for (let y = 0; y < Math.ceil(ELEMENT_COUNT / Math.floor(window.width / TYPE_SELECTOR.SIZE)); y++) {
	for (let x = 0; x < Math.floor(window.width / TYPE_SELECTOR.SIZE); x++) {
		if (eTS >= ELEMENT_COUNT) break;
		TYPE_SELECTOR.create(eTS, TYPE_SELECTOR.SIZE * x, TYPE_SELECTOR.SIZE * y);
		eTS++;
	}
}

class SETTINGS extends ElementScript {
	init(obj, type) {
		obj.scripts.removeDefault();
		this.type = type;
		this.totalControls = Object.entries(controls).length;
		this.rowHeight = obj.height / this.totalControls;
		this.font = new Font(this.rowHeight * 0.7, "Arial");
	}
	click(obj) {
	}
	update(obj) {
		obj.hidden = !SETTINGS_SHOWN;
	}
	draw(obj, name, shape) {
		renderer.draw(Color.WHITE).rect(shape);
		const borderColor = Color.GRAY;
		const entries = Object.entries(controls);
		for (let i = 0; i < this.totalControls; i++) {
			const y = shape.y + i * this.rowHeight;
			renderer.stroke(borderColor).rect(-shape.width / 2, y, shape.width, this.rowHeight);
			renderer.textMode = TextMode.CENTER_CENTER;
			renderer.draw(Color.BLACK).text(this.font, entries[i][0], -shape.width / 4, y + this.rowHeight / 2);
			renderer.textMode = TextMode.CENTER_CENTER;
			renderer.draw(Color.BLACK).text(this.font, entries[i][1], shape.width / 4, y + this.rowHeight / 2);
		}
		renderer.stroke(borderColor).line(0, -shape.height / 2, 0, shape.height / 2);

	}
	static create() {
		const panel = scene.main.addUIElement("panel", width / 2, height / 2, width * 0.75, height * 0.75);
		panel.scripts.add(SETTINGS);
		return panel;
	}
}

SETTINGS.create();

if (false) {
	const x0 = (WIDTH >> 1) - (HEIGHT >> 1);
	const x1 = (WIDTH >> 1) + (HEIGHT >> 1);
	makeLine(x0, 0, x1, HEIGHT, TYPES.CONDENSED_STONE, 20, 1);
	makeLine(x0, HEIGHT, x1, 0, TYPES.CONDENSED_STONE, 20, 1);
	makeLine(x0, 0, x1, HEIGHT, TYPES.BRICK, 15, 1, ALL_PASSTHROUGH);
	makeLine(x0, HEIGHT, x1, 0, TYPES.BRICK, 15, 1, ALL_PASSTHROUGH);
	makeCircle(WIDTH >> 1, HEIGHT >> 1, TYPES.CONDENSED_STONE, 105, 1);
	makeCircle(WIDTH >> 1, HEIGHT >> 1, TYPES.BRICK, 100, 1, ALL_PASSTHROUGH);
	makeCircle(WIDTH >> 1, HEIGHT >> 1, TYPES.AIR, 70, 1, ALL_PASSTHROUGH);
	makeCircle((WIDTH >> 1) - 45, (HEIGHT >> 1) + 45, TYPES.LIGHT, 15, 1, ALL_PASSTHROUGH);
	makeCircle((WIDTH >> 1) + 45, (HEIGHT >> 1) + 45, TYPES.LIGHT, 15, 1, ALL_PASSTHROUGH);
	makeCircle((WIDTH >> 1), (HEIGHT >> 1) - 62, TYPES.LIGHT, 15, 1, ALL_PASSTHROUGH);
	// makeCircle((WIDTH >> 1) + 45, (HEIGHT >> 1) - 45, TYPES.LIGHT, 15, 1, ALL_PASSTHROUGH);
	makeCircle(WIDTH >> 1, HEIGHT >> 1, TYPES.CONDENSED_STONE, 30, 1, ALL_PASSTHROUGH);
	makeCircle(WIDTH >> 1, HEIGHT >> 1, TYPES.LAVA, 29, 1, ALL_PASSTHROUGH);
	// makeCircle(WIDTH >> 1, (HEIGHT >> 1) - 15, TYPES.LAVA, 15, 1);
}

if (false) {
	function sample(i, j, EPS) {
		const p = Random.perlin2D(i, j, 0.05);
		return p > 0.5 - EPS && p < 0.5 + EPS;
	}

	for (let i = 0; i < WIDTH; i++) for (let j = 0; j < HEIGHT; j++) {
		if (sample(i, j, 0.05))
			Element.setCell(i, j, TYPES.CONDENSED_STONE);
	}
}

let brush = 0;
let brushSize = 15;
let paused = false;

let debugFrame;

const tex = new Texture(WIDTH, HEIGHT);

const idTex = new Texture(WIDTH, HEIGHT).shader((x, y, dest) => dest.set(Color.BLANK));

let RTX = true;

const randomlib = `
float random11(float seed) {
	float a = mod(seed * 6.12849, 8.7890975);
	float b = mod(a * 256745.4758903, 232.567890);
	return mod(abs(a * b), 1.0);
}

float random21(vec2 seed) {
	return random11(seed.x + 3.238975 * seed.y + 5.237 * seed.x);
}

vec2 smoothT(vec2 t) {
	return t * t * (-2.0 * t + 3.0);
} 

float perlin(vec2 seed) {
	vec2 samplePoint = floor(seed);
	float a = random21(samplePoint);
	float b = random21(samplePoint + vec2(1.0, 0.0));
	float c = random21(samplePoint + vec2(0.0, 1.0));
	float d = random21(samplePoint + vec2(1.0));
	vec2 t = smoothT(mod(seed, 1.0));
	return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}
float octavePerlin(vec2 seed) {
	seed += 10.0;
	float sum = 0.0;
	float scale = 0.0;
	for (float o = 0.0; o < 20.0; o++) {
		float i = o + 1.0;
		sum += perlin(seed * i) / i;
		scale += 1.0 / i;
	}
	return sum / scale;
}
`;

const createGodRays = (image, PIXEL_SIZE = 1, DISTANCE_SCALE = PIXEL_SIZE) => {
	const godRays = new GPUShader(image.width / PIXEL_SIZE, image.height / PIXEL_SIZE, `
		uniform int lightDistance;
		uniform vec4 ambientLighting;
		uniform vec4 lightColor;
		uniform vec2 lightPosition;
		uniform float lightIntensity;
		uniform float localAttenuation;
		uniform float globalAttenuation;
		uniform float solidLightCutoff;
		uniform bool clouds;
		uniform float time;
		uniform bool identity;
		uniform float transparency;

		uniform sampler2D image;
		uniform sampler2D ids;

		${randomlib}

		float getClouds(vec2 pos) {
			float oc = clamp(octavePerlin(pos * vec2(14.0, 12.0)) - 0.1, 0.0, 1.0);
			float pr = perlin(vec2(pos.x, 0.0) * 0.01);
			float yCutoff = mix(0.5, 0.7, pr);
			float cutoffFactor = smoothstep(yCutoff + 0.3, yCutoff - 0.1, pos.y);
			float t = clamp(pow(oc * 2.0, 3.5) * cutoffFactor, 0.0, 1.0);
			return mix(0.0, oc, t);
		}

		int getId(vec2 p) {
			return int(texelFetch(ids, ivec2(p), 0).r * 255.0);
		}

		vec4 getPixelTexture(vec2 uv) {
			vec2 imageRes = vec2(textureSize(image, 0));
			vec2 p = uv * imageRes;
			vec2 prevP = p;

			// distortion
			int id = getId(p);
			if (${[...LIQUID].map(id => `id == ${id}`).join(" || ")}) {
				float noise = perlin(p * 0.1) * 0.3;
				const float speed = 1.0;
				p.x += 2.0 * sin(time * 0.03 * speed + p.y * 0.1 + noise);
				p.y += 2.0 * perlin(p + time * 0.01 * speed + p.x * 0.05 + noise);
			}

			if (id != getId(p)) p = prevP;

			vec4 color = texelFetch(image, ivec2(p), 0);
			// color.a = 1.0 - color.a;
			return color;
		}

		vec4 getPixel(vec2 uv) {
			vec2 imageRes = vec2(textureSize(image, 0));
			return texelFetch(image, ivec2(uv * imageRes), 0);
		}

		bool light(vec2 uv) {
			vec4 color = getPixel(uv);
			return color.a == 0.0;
		}

		float getFactor(float distance, float attn) {
			return clamp(1.0 / pow(distance * attn + 1.0, 2.0) - 0.05, 0.0, 1.0);
		}

		vec4 getDirectionalLight(vec2 uv) {
			if (light(uv)) return vec4(1.0);
			
			float distance = 100000.0;

			vec2 lightDirection = normalize(position - lightPosition);
			

			for (int i = 0; i < lightDistance; i++) {
				float fi = float(i);
				vec2 guv = uv - lightDirection * fi / resolution;
				if (light(guv)) {
					distance = (fi + 2.0) * float(${DISTANCE_SCALE});
					break;
				}
			}

			float globalDistance = max(0.0, length(position - lightPosition) - solidLightCutoff);
			float globalFalloff = getFactor(globalDistance, globalAttenuation);
			float localFalloff = getFactor(distance, localAttenuation);

			return lightColor * lightIntensity * globalFalloff * localFalloff;
		}

		// stolen from websites and whatnot
		vec3 ACESFilm(vec3 x) {
			float a = 2.51f;
			float b = 0.03f;
			float c = 2.43f;
			float d = 0.59f;
			float e = 0.14f;
			return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
		}

		float normal(float seed, float mu, float sd) {
			float area = random11(seed);
			return mu + sd * log(1.0 / area - 1.0) / -1.8;
		}

		bool glows(vec4 color) {
			return color.a > 1.0 / 255.0;
		}

		vec4 _shader_() {
			const int SAMPLES = 50;
			
			float seed = position.x * 212.8 + position.y * 12847.2;// + time;
			
			vec4 albedo = getPixelTexture(position / resolution);
			bool bloom = albedo == vec4(0.0);
			float attenuationFactor = bloom ? 1.0 : 0.0;
			float sampleSD = bloom ? 3.0 : 20.0;
			vec3 directionalLighting = vec3(0.0);

			float totalAttn = 0.0;

			for (int i = 0; i < SAMPLES; i++) {
				vec2 pos = vec2(
					normal(seed, position.x, sampleSD),
					normal(seed + 23019287.2, position.y, sampleSD)
				);

				seed += 12.13;

				vec4 color = getPixel(pos / resolution);
				
				vec2 v = pos - position;
				float d2 = dot(v, v);
				float attn = 1.0 / (1.0 + attenuationFactor * d2);
				totalAttn += attn;
				
				if (glows(color))
					directionalLighting += color.rgb * color.a * attn;
			}
			

			vec3 hdr;
			if (albedo == vec4(0.0)) hdr = albedo.rgb + directionalLighting;
			else if (glows(albedo)) hdr = (albedo * ambientLighting + vec4(directionalLighting, 1.0)).rgb; 
			else hdr = (albedo * (ambientLighting + vec4(directionalLighting, 1.0))).rgb;
			

			return vec4(hdr, 1.0);
		}

		vec4 shader() {
			if (identity) {
				vec4 col = texelFetch(image, ivec2(position), 0);
				return vec4(col.rgb, 1.0);
			}

			vec2 uv = position / resolution;
			vec4 directional = getDirectionalLight(uv);
			vec4 albedo = getPixelTexture(uv);
			if (clouds && light(uv)) {
				float clouds = getClouds(vec2(uv.x + time * 0.0007, uv.y));
				return vec4(1.0, 1.0, 1.0, clouds);
			}

			int S = 6; // perfect possible value, 1 / (1 + 16^2) < 1 / 255
			int T = 1;
			vec4 glow = vec4(0.0);
			for (int i = -S; i <= S; i += T)
			for (int j = -S; j <= S; j += T) {
				vec2 off = vec2(i, j);
				vec4 px = getPixel((position + off) / resolution);
				glow += vec4(px.rgb * px.a, (px.r + px.g + px.b) / 3.0 * px.a) / (1.0 + dot(off, off));
			}
			
			albedo *= (ambientLighting + directional);
			
			vec3 hdr = albedo.rgb + glow.rgb;

			// hdr = 1.0 / (1.0 + exp(-5.0 * (hdr - 0.5)));
			// hdr = ACESFilm(hdr);

			if (albedo != vec4(0.0)) return vec4(hdr, ceil(albedo.a) * (1.0 - transparency) + transparency);
			else if (glow.a > 0.0) return vec4(hdr / glow.a, glow.a);
			return vec4(0.0);
		}
	`);


	return function ({
		direction,
		position = direction.times(1),
		color = new Color(255, 255, 255),
		ambient = new Color(20, 20, 20),
		intensity = 2,
		attenuation = direction ? 0 : 0.1,
		solidUntil = 0,
		clouds = false,
		identity = false,
		transparency = 1.0,
		ids
	}) {
		godRays.setArguments({
			image,
			clouds,
			time: intervals.frameCount,
			lightColor: color,
			ambientLighting: ambient,
			lightPosition: position.over(DISTANCE_SCALE),
			lightIntensity: intensity,
			lightDistance: 200 / DISTANCE_SCALE,
			globalAttenuation: attenuation,
			localAttenuation: 0.03,
			solidLightCutoff: solidUntil / DISTANCE_SCALE,
			identity,
			transparency,
			ids
		});

		return godRays;
	};
};

const rays = createGodRays(tex, 1, 1);

function lastBrush() {
	brush = (brush - 1 + ELEMENT_COUNT) % ELEMENT_COUNT;
}

function nextBrush() {
	brush = (brush + 1) % ELEMENT_COUNT;
}

function text(font, text, x, y) {
	const f = font.fontSize * 0.1;
	renderer.stroke(Color.WHITE, 4).text(font, text, x, y);
	renderer.draw(Color.BLACK).text(font, text, x, y);
}

const PAN_SENSITIVITY = 20;
const ZOOM_SENSITIVITY = 0.1
let SELECTORS_SHOWN = true;
let SETTINGS_SHOWN = false;

const BRUSH_TYPES = ["Circle", "Square", "Ring", "Forceful", "Row", "Column"]
let brushType = 0;
let eraseOnly = false;

let currentDebugColor = Color.RED;
let debugColor1 = Color.RED;
let debugColor2 = Color.BLUE;
let debugColorInterval = 7;
let debugOscillating = false;

let lightSources = [];

const backgroundTex = new Texture(WIDTH, HEIGHT);
backgroundTex.shader((x, y, dest) => {
	const factor = 1.2;
	const fx = Number.clamp(~~(x / factor), 0, WIDTH - 1);
	const fy = Number.clamp(~~(y / factor), 0, HEIGHT - 1);
	dest.set(
		DATA[TYPES.TILE_BASE]
			.getColor(fx, fy)
			.times(0.1)
			.opaque
	);
});

function handleBrushInput() {
	if (keyboard.pressed("Control")) return;

	for (const touch of touches.allPressed) {
		const r = brushSize;
		const { world } = touches.get(touch);

		const hovered = scene.main.getElementsWithScript(TYPE_SELECTOR).some(el => !el.hidden && el.collidePoint(world));

		if (hovered) {
			anyHovered = true;
			continue;
		}

		const { x: ox, y: oy } = Vector2.floor(world.over(CELL));
		const { x: oxl, y: oyl } = Vector2.floor(mouse.worldLast.over(CELL));

		if (brush === TYPES.PARTICLE)
			explode(ox, oy, r);
		else if (brush === TYPES.ENDOTHERMIA)
			explode(ox, oy, r);
		else {
			const handleCell = (x, y) => {
				if (Element.inBounds(x, y)) {
					if (brush === TYPES.EXOTHERMIA)
						Element.tryBurn(x, y, TYPES.FIRE);
					else if (brush !== TYPES.AIR && eraseOnly) {
						const { id } = grid[x][y];
						if (
							id === brush ||
							(DATA[id].reference && grid[x][y].reference === brush)
						) Element.setCell(x, y, TYPES.AIR);
					} else if (brush === TYPES.AIR || Element.isEmpty(x, y))
						Element.setCell(x, y, brush);
				}
			};
			if (brushType == 0) { // Circle
				for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
					if (i * i + j * j < r * r) {
						const x = i + ox;
						const y = j + oy;
						handleCell(x, y);
					}
				}
			}
			else if (brushType == 1) { // Square
				let or = r - 1;
				for (let i = -or; i <= or; i++) for (let j = -or; j <= or; j++) {
					const x = i + ox;
					const y = j + oy;
					handleCell(x, y);
				}
			}
			else if (brushType == 2) { // Ring
				for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
					if (i * i + j * j < r * r && i * i + j * j >= (r - 1) * (r - 1)) {
						const x = i + ox;
						const y = j + oy;
						handleCell(x, y);
					}
				}
			}
			else if (brushType == 3) { // Forceful
				const CHAOS = 1;
				const vel = 0.3;
				for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
					if (i * i + j * j < r * r) {
						const x = i + ox;
						const y = j + oy;
						handleCell(x, y);
						if (Element.inBounds(x, y)) createParticle(
							new Vector2(x, y),
							new Vector2(
								vel * i + Random.range(-CHAOS, CHAOS),
								vel * j + Random.range(-CHAOS, CHAOS)
							)
						);
					}
				}
			}
			else if (brushType == 4) { // Row
				let disp = oy-oyl;
				for (let i = 0; i <= WIDTH; i++) for (let j = -(r - 1); j <= (r - 1); j++) {
					const x = i;
					const y = j + oy;
					handleCell(x, y);
				}
			}
			else if (brushType == 5) { // Columm
				let disp = ox-oxl;
				for (let i = 0; i <= HEIGHT; i++) for (let j = -(r - 1); j <= (r - 1); j++) {
					const x = j + ox;
					const y = i;
					handleCell(x, y);
				}
			}
			else if (brushType == 6) { // EraseOnly
				if (brush !== TYPES.EXOTHERMIA && brush !== TYPES.AIR) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
					if (i * i + j * j < r * r) {
						const x = i + ox;
						const y = j + oy;
						if (Element.inBounds(x, y)) {
							const { id } = grid[x][y];
							if (
								id === brush ||
								(DATA[id].reference && grid[x][y].reference === brush)
							) Element.setCell(x, y, TYPES.AIR);
						}
					}
				}
			}
		}
	}
}

function handleInput() {
	
	function clearAll() {
		for (let x = 0; x < WIDTH; x++)
		for (let y = 0; y < HEIGHT; y++)
			Element.setCell(x, y, TYPES.AIR);
		scene.main.removeElements(scene.main.getElementsWithScript(DYNAMIC_OBJECT));
		for (let i = 0; i < particles.length; i++)
			particles[i].remove();
		particles = [];	
		for (let i = 0; i < CHUNK_WIDTH; i++) for (let j = 0; j < CHUNK_HEIGHT; j++)
			chunks[i][j].sceneObject.scripts.CHUNK_COLLIDER.remesh();
	}

	if (keyboard.justPressed("d")) { // download
		fileSystem.writeFile(SAVE_FILE_PATH, new WorldSave(grid, WorldSave.getRigidbodies()));
		if (keyboard.pressed("Shift")) fileSystem.downloadFile(SAVE_FILE_PATH);
	}

	if (keyboard.justPressed("u")) { // upload
		const replace = () => {
			clearAll();
			const { grid: uploadedGrid, rigidbodies } = fileSystem.readFile(SAVE_FILE_PATH);
			const w = Math.min(WIDTH, uploadedGrid.length);
			const h = Math.min(HEIGHT, uploadedGrid[0].length);
			for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
				grid[i][j] = uploadedGrid[i][j];
				Element.updateCell(i, j);
			}
			WorldSave.instantiateRigidbodies(rigidbodies);
		};
		if (keyboard.pressed("Shift"))
			fileSystem.uploadFile(SAVE_FILE_PATH).then(replace);
		else replace();
	}

	if (!SETTINGS_SHOWN) {
		for (const key of keyboard.downQueue) {
			if (keyboard.released("Shift")) {
				if (key === "ArrowRight" || key === ".") {
					if (brushType + 1 < BRUSH_TYPES.length) brushType++;
					else brushType = 0;
				} else if (key === "ArrowLeft" || key === ",") {
					if (brushType > 0) brushType--;
					else brushType = BRUSH_TYPES.length - 1;
				} else if (key === "ArrowUp") brushSize++;
				else if (key === "ArrowDown") brushSize = Math.max(brushSize - 1, 1);
				else if (key === "e") {
					scene.camera.restoreZoom();
					scene.camera.position = middle;
				} else if (key === "p") {
					eraseOnly = !eraseOnly;
				} else if (key === "r") {
					clearAll();		
				} else if (key === "a") {
					const { x: mx, y: my } = Vector2.floor(mouse.world.over(CELL));
					if (Element.inBounds(mx, my) && STATIC_SOLID.has(grid[mx][my].id)) {
						const id = grid[mx][my].id;
						let toVisit = [new Vector2(mx, my)];
						const key = (x, y) => x + "|" + y;
						const points = [];
						const visited = new Set([key(mx, my)]);
						let nextToVisit = [];
						const tryVisit = (x, y) => {
							if (!Element.inBounds(x, y) || grid[x][y].id !== id)
								return;
							const k = key(x, y);
							if (!visited.has(k)) {
								visited.add(k);
								nextToVisit.push(new Vector2(x, y));
							}
						};
						while (toVisit.length) {
							points.push(...toVisit);
							nextToVisit = [];
							for (let i = 0; i < toVisit.length; i++) {
								const { x, y } = toVisit[i];
								tryVisit(x - 1, y);
								tryVisit(x, y - 1);
								tryVisit(x + 1, y);
								tryVisit(x, y + 1);
							}
							toVisit = nextToVisit;
						}
						const bounds = Rect.bound(points);
						const { x, y, width, height } = bounds;
						const objGrid = Array.dim(width + 1, height + 1)
							.map(() => new Cell(TYPES.AIR));
						for (let i = 0; i <= width; i++) for (let j = 0; j <= height; j++) {
							if (visited.has(key(i + x, j + y))) {
								grid[i + x][j + y].get(objGrid[i][j]);
								Element.die(i + x, j + y);
							}
						}
						const minBounds = new Vector2(0, 0);
						const maxBounds = new Vector2(CHUNK_WIDTH - 1, CHUNK_HEIGHT - 1);
						const minChunk = Vector2.clamp(Vector2.floor(bounds.min.over(CHUNK)), minBounds, maxBounds);
						const maxChunk = Vector2.clamp(Vector2.ceil(bounds.max.over(CHUNK)), minBounds, maxBounds);
						for (let i = minChunk.x; i <= maxChunk.x; i++)
						for (let j = minChunk.y; j <= maxChunk.y; j++) {
							chunks[i][j].sceneObject.scripts.CHUNK_COLLIDER.remesh();
						}
						const obj = scene.main.addPhysicsElement("obj", 0, 0, true, new Controls("i", "k", "j", "l"));
						obj.scripts.add(DYNAMIC_OBJECT, objGrid, new Vector2(x, y));
						if (keyboard.pressed("l")) obj.scripts.add(PLAYER_MOVEMENT);
					}
				} else if (key == "0") brushType = 0;
				else if (key == "1") brushType = 1;
				else if (key == "2") brushType = 2;
				else if (key == "3") brushType = 3;
				else if (key == "4") brushType = 4;
				else if (key == "5") brushType = 5;
				else if (key == "6") brushType = 5;
			} else {
				if (key === "+") scene.camera.zoomIn(ZOOM_SENSITIVITY);
				else if (key === "_") scene.camera.zoomOut(ZOOM_SENSITIVITY);
				else if (key === "ArrowUp") scene.camera.position.add(new Vector2(0, -PAN_SENSITIVITY));
				else if (key === "ArrowDown") scene.camera.position.add(new Vector2(0, PAN_SENSITIVITY))
				else if (key === "ArrowRight") scene.camera.position.add(new Vector2(PAN_SENSITIVITY, 0));
				else if (key === "ArrowLeft") scene.camera.position.add(new Vector2(-PAN_SENSITIVITY, 0));
			}
		}

		if (keyboard.justPressed(" ")) paused = !paused;
		if (keyboard.justPressed("g")) RTX = !RTX;
		if (keyboard.justPressed("s")) SELECTORS_SHOWN = !SELECTORS_SHOWN;

		if (keyboard.pressed("Control")) {
			if (mouse.pressed("Left"))
				scene.camera.position.add(mouse.worldLast.minus(mouse.world));
			if (mouse.wheelDelta > 0)
				scene.camera.zoomOut(ZOOM_SENSITIVITY);
			else if (mouse.wheelDelta < 0)
				scene.camera.zoomIn(ZOOM_SENSITIVITY);
		} else {
			if (mouse.wheelDelta > 0) brushSize = Math.max(brushSize - 1, 1);
			if (mouse.wheelDelta < 0) brushSize++;
		}
			
	}

	if (keyboard.justPressed("Escape")) {
		SETTINGS_SHOWN = !SETTINGS_SHOWN;
		paused = SETTINGS_SHOWN;
	}

	canvas.cursor = scene.main.getElementsWithScript(TYPE_SELECTOR).some(el => !el.hidden && el.collidePoint(mouse.screen)) ? "pointer" : "none";
}

function stepParticles() {
	const newParticles = [];

	for (let i = 0; i < particles.length; i++) {
		const particle = particles[i];
		if (particle.update())
			newParticles.push(particle);
		else particle.remove();
	}

	particles = newParticles;
}

function stepSimulation(time) {
	const neg_x = !!(time % 2);
	const neg_y = !!((time >> 1) % 2);

	for (let i = 0; i < WIDTH; i++) for (let j = 0; j < HEIGHT; j++)
		grid[i][j].updated = false;

	const cells = Array.dim(CHUNK * CHUNK).map((_, i) => i);

	for (let i = 0; i < cells.length; i++) {
		const inx0 = i;
		const inx1 = Random.int(0, cells.length - 1);
		const t = cells[inx0];
		cells[inx0] = cells[inx1];
		cells[inx1] = t;
	}

	for (let i = 0; i < CHUNK_WIDTH; i++) for (let j = 0; j < CHUNK_HEIGHT; j++) {
		const cx = neg_x ? CHUNK_WIDTH - 1 - i : i;
		const cy = neg_y ? CHUNK_HEIGHT - 1 - j : j;
		const chunk = chunks[cx][cy];
		if (chunk.sleep) continue;

		const cxAbs = chunk.x * CHUNK;
		const cyAbs = chunk.y * CHUNK;

		for (let i = 0; i < cells.length; i++) {
			const coord = cells[i];
			const x = cxAbs + ~~(coord / CHUNK);
			const y = cyAbs + coord % CHUNK;
			if (x >= WIDTH || y >= HEIGHT)
				continue;
			const cell = grid[x][y];
			if (!cell.updated) {
				DATA[cell.id].update(x, y);
				cell.updated = true;
			}
		}
	}
}

function stepGraphics() {
	const col = new Color(0, 0, 0, 1);

	for (let i = 0; i < CHUNK_WIDTH; i++) for (let j = 0; j < CHUNK_HEIGHT; j++) {
		const chunk = chunks[i][j];
		if (chunk.sleep && chunk.sleepNext)
			continue;

		const cx = chunk.x * CHUNK;
		const cy = chunk.y * CHUNK;
		for (let i = 0; i < CHUNK; i++) for (let j = 0; j < CHUNK; j++) {
			const x = cx + i;
			const y = cy + j;
			if (x >= WIDTH || y >= HEIGHT)
				continue;

			const cell = grid[x][y];
			if (cell.id !== lastIds[x][y]) {
				col.red = cell.id;
				const element = DATA[cell.id];
				tex.setPixel(x, y, element.getColor(x, y));
				col.red = cell.id;
				idTex.setPixel(x, y, col);
				lastIds[x][y] = cell.id;
			}
		}
	}
}

function stepSleeping() {
	for (let i = 0; i < CHUNK_WIDTH; i++) for (let j = 0; j < CHUNK_HEIGHT; j++) {
		const chunk = chunks[i][j];
		chunk.sleep = chunk.sleepNext;
		chunk.sleepNext = true;
	}
}

function displayWorld() {
	scene.camera.drawInWorldSpace(() => {
		const image = rays({
			direction: new Vector2(100000, -100000),//lightSources[0][0], lightSources[0][1]),
			color: new Color(105, 105, 50),
			ambient: new Color(200, 200, 200),
			identity: !RTX,
			ids: idTex,
			transparency: 0.8
		});
		// renderer.fill(Color.BLACK);
		// renderer.preservePixelart = false;
		renderer.image(backgroundTex).rect(0, 0, WIDTH * CELL, HEIGHT * CELL);
		renderer.image(image).rect(0, 0, WIDTH * CELL, HEIGHT * CELL);
		// renderer.preservePixelart = true;
		
	});
}

function stepParticleGraphics() {
	for (let i = 0; i < particles.length; i++) {
		particles[i].draw();
	}
}

function displayBrushPreview() {
	scene.camera.drawInWorldSpace(() => {

		// brush previews
		const brushPreviewArgs = [eraseOnly ? Color.RED : Color.LIME, 1 / scene.camera.zoom];
		const cellBrushSize = brushSize * CELL;
		renderer.draw(brushPreviewArgs[0]).circle(mouse.world, brushPreviewArgs[1]);
		switch (BRUSH_TYPES[brushType]) {
			case "Circle":
				renderer.stroke(...brushPreviewArgs).circle(mouse.world, cellBrushSize);
				break;
			case "Square":
				renderer.stroke(...brushPreviewArgs).rect(Rect.fromMinMax(mouse.world.minus(cellBrushSize), mouse.world.plus(cellBrushSize)));
				break;
			case "Ring":
				renderer.stroke(...brushPreviewArgs).circle(mouse.world, cellBrushSize);
				renderer.stroke(...brushPreviewArgs).circle(mouse.world, cellBrushSize - CELL);
				break;
			case "Forceful": {
				renderer.stroke(...brushPreviewArgs).shape(new Polygon(Polygon.regular(24, cellBrushSize).vertices.map((v, i) => i % 2 ? v.times(1.3) : v)).move(mouse.world));
			}; break;
			case "Row":
				renderer.stroke(...brushPreviewArgs).rect(0, mouse.world.y - cellBrushSize, WIDTH * CELL, cellBrushSize * 2);
				break;
			case "Column":
				renderer.stroke(...brushPreviewArgs).rect(mouse.world.x - cellBrushSize, 0, cellBrushSize * 2, HEIGHT * CELL);
				break;

		}
	});
}

function displayDebugInfo() {
	
	if (keyboard.pressed("v")) {
		if (!debugFrame)
			debugFrame = new FastFrame(width, height);

		debugFrame.renderer.transform = scene.camera;

		if (debugOscillating) {
			if (time % debugColorInterval == 0 && currentDebugColor == debugColor1) currentDebugColor = debugColor2;
			else if (time % debugColorInterval == 0) currentDebugColor = debugColor1;
		}

		for (let i = 0; i < CHUNK_WIDTH; i++) for (let j = 0; j < CHUNK_HEIGHT; j++) {
			const chunk = chunks[i][j];

			if (chunk.sleep && chunk.sleepNext)
				continue;

			const cx = chunk.x * CHUNK;
			const cy = chunk.y * CHUNK;
			for (let i = 0; i < CHUNK; i++) for (let j = 0; j < CHUNK; j++) {
				const x = cx + i;
				const y = cy + j;
				if (x >= WIDTH || y >= HEIGHT)
					continue;
				const cell = grid[x][y];
				if (cell.vel.sqrMag) {
					debugFrame.renderer.stroke(currentDebugColor).arrow(x * CELL, y * CELL, x * CELL + cell.vel.x * CELL, y * CELL + cell.vel.y * CELL);
				}

			}

			debugFrame.renderer.stroke(currentDebugColor).rect(i * CHUNK * CELL, j * CHUNK * CELL, CHUNK * CELL, CHUNK * CELL);
		}

		for (const particle of particles) {
			debugFrame.renderer.stroke(currentDebugColor).arrow(Vector2.floor(particle.position).times(CELL), Vector2.floor(particle.position.plus(particle.velocity)).times(CELL));
		}

		renderer.image(debugFrame).default(0, 0);
		debugFrame.renderer.clear();
	}

	let densityMappingByResistance = false;

	if (keyboard.pressed("b")) {
		if (!debugFrame)
			debugFrame = new FastFrame(width, height);

		debugFrame.renderer.transform = scene.camera;

		const densityMap = Array.dim(CHUNK_WIDTH, CHUNK_HEIGHT);

		for (let k = 0; k < CHUNK_WIDTH; k++) for (let l = 0; l < CHUNK_HEIGHT; l++) {
			let d = 0;

			const chunk = chunks[k][l];
			const cx = chunk.x * CHUNK;
			const cy = chunk.y * CHUNK;
			debugFrame.renderer.draw(Color.WHITE).rect(k * CHUNK * CELL, l * CHUNK * CELL, CHUNK * CELL, CHUNK * CELL);

			for (let i = 0; i < CHUNK; i++) for (let j = 0; j < CHUNK; j++) {
				const x = cx + i;
				const y = cy + j;

				if (x >= WIDTH || y >= HEIGHT)
					continue;
				const cell = grid[x][y];
				if (cell.id != 0) {
					if (!densityMappingByResistance) d++;
					else d += DATA[cell.id].resistance;
				}
			}
			d /= CHUNK * CHUNK;
			let c = Color.lerp(Color.BLACK, Color.WHITE, d);
			debugFrame.renderer.draw(c).rect(k * CHUNK * CELL, l * CHUNK * CELL, CHUNK * CELL, CHUNK * CELL);
			densityMap[k][l] = d;
		}

		renderer.image(debugFrame).default(0, 0);
		debugFrame.renderer.clear();

		if (keyboard.pressed("Shift")) {
			renderer.textMode = TextMode.TOP_LEFT;
			for (let i = 0; i < CHUNK_WIDTH; i++) for (let j = 0; j < CHUNK_HEIGHT; j++) {
				text(Font.Arial10, Math.round(densityMap[i][j] * 100) / 100, i * CHUNK * CELL + 10, j * CHUNK * CELL + 10);
			}
		}
	}
}

function injectDynamicBodies() {
	const dyn = scene.main.getElementsWithScript(DYNAMIC_OBJECT);
	for (let i = 0; i < dyn.length; i++) 
		dyn[i].scripts.DYNAMIC_OBJECT.inject();
}

function extractDynamicBodies() {
	const dyn = scene.main.getElementsWithScript(DYNAMIC_OBJECT);
	for (let i = 0; i < dyn.length; i++) 
		dyn[i].scripts.DYNAMIC_OBJECT.extract();
}

intervals.continuous(time => {
	// try {
		
		handleInput();
		injectDynamicBodies();
		handleBrushInput();
		
		const singleStep = keyboard.justPressed("Enter");

		const simStep = !paused || singleStep;
		if (simStep) {
			stepSimulation(time);
			stepParticles();
		}
		
		stepGraphics();
		stepParticleGraphics();
		extractDynamicBodies(); // also displays them
		
		if (simStep) stepSleeping();

		displayWorld();
		displayBrushPreview();
		displayDebugInfo();


		if (!SELECTORS_SHOWN) {
			let hoveredElementType = TYPES.AIR;
			let hoveredElementActs = 0;
			{
				const coord = Vector2.floor(mouse.world.over(CELL));
				if (Element.inBounds(coord.x, coord.y)) {
					hoveredElementType = grid[coord.x][coord.y].id;
					hoveredElementActs = grid[coord.x][coord.y].acts;
				}
			};
			
			renderer.textMode = TextMode.TOP_LEFT;
			text(Font.Arial20, `brush: ${typeName(brush)}, brushSize: ${brushSize}, brushType: ${BRUSH_TYPES[brushType]} | ${brushType}, paused: ${paused}, RTX: ${RTX}, fps: ${intervals.fps}`, 10, 10);
			renderer.textMode = TextMode.TOP_RIGHT;
			text(Font.Arial15, hoveredElementType ? typeName(hoveredElementType) + (hoveredElementActs ? " (" + hoveredElementActs + ")" : "") : "", width - 10, 10);
		}
	// } catch (err) {
	// 	alert(err + "\n" + err.stack);
	// }
}, IntervalFunction.UPDATE);
