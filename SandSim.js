const synth = new Synth();

let simFrameCount = 0;

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
	"a": "Animate Wall",
	"v": "toggle debug view",
	"n, m, & k": "(line brush) place, apply, clear (respectively)",
	"t": "switch render view (normal, information, and ant views)"
};

canvas.clearScreen = () => renderer.fill(Color.BLACK);

const TYPES = Object.fromEntries([
	"AIR",
	"TEST", //"URANIUM", "ORANGEJUICE", "POWDER", "OXYGEN", "BURNING_BRICKS", "COPPER_BRICKS",
	"THICKET_SEED", "THICKET", "THICKET_BUD", "THICKET_STEM", "INCENSE_SMOKE", "INCENSE",
	"SUNFLOWER_PETAL", "SUNFLOWER_STEM", "SUNFLOWER_SEED", "TREE_SEED", "TREE_GENERATOR", "LEAVES",
	"SOIL", "DAMP_SOIL", "ROOT", "GRASS", "FLOWER",
	"HIGH_EXPLOSIVE", "EXPLOSIVE", "EXPLOSIVE_DUST", "FLASH_PAPER", "WET_PAPER",
	"STONE", "CONDENSED_STONE", "MARBLE", "GRANITE", "MEDUSAS_GEM", "CARO_GEM",
	"CLAY", "BRICK",
	"TILE_BASE", "DECUMAN_TILE",
	"GLAZE_BASE", "DECUMAN_GLAZE",
	"PRIDIUM", "GENDERFLUID",
	"PARTICLE",
	"EXOTHERMIA", "FIRE", "BLUE_FIRE", "SPIRAL_FIRE", "BOUNCE_BEAM", "BOUNCE_GREEN_BEAM",
	"BAHHUM", //"GREEK_FIRE",
	"ESTIUM", "ESTIUM_GAS",
	"DDT",
	"ANT", "DAMSELFLY", "MINNOW", "MITE", "LIGHTNING_BUG", "BEE", "TERMITE", "ANT_HILL",
	"HIVE", "HONEY", "SUGAR", "CARMEL",
	"WATER", "WATER_VAPOR", "POND_WATER", "ICE", "SNOW", "STAINED_SNOW", "SALT", "SALT_WATER",
	"SAND", "KELP", "KELP_TOP", "PNEUMATOCYST",
	"COTTON", "DYED_COTTON",
	"WOOD", "COAL", "OIL", "FUSE", "ASH",
	"WAX", "GRAINY_WAX", "MOLTEN_WAX",
	"LAVA", "POWER_LAVA", "GREEN_LAVA",
	"STEAM", "SMOKE", "HYDROGEN",
	"GLASS", "ACID", "UNSTABLE_ELEMENT", "SEMI_STABLE_ELEMENT", "GROUNDING_METAL", "POSITIVE_METAL", "CONDUCTIVE_FLUID", "BLUE_ELECTRICITY",
	"BATTERY", "ELECTRICITY","GERMANIUM", "ACTIVE_GERMANIUM", "BOID",
	"CONVEYOR_LEFT", "CONVEYOR_RIGHT", "STEEL",
	"COPPER", "LIQUID_COPPER",
	"LEAD", "LIQUID_LEAD",
	"GOLD", "AUREATE_DUST", "LIQUID_GOLD", "MAGNESIUM", "MAGNESIUM_FIRE",
	"IRON", "LIQUID_IRON", "RUST",
	"MERCURY", "TERMINATOR",
	"RADIUM", "RADIUM_GEM", "ACTINIUM", "THORIUM",
	"ANTIMATTER",
	"LIGHTNING", "LIGHT", "LIGHT_SAD", "BOUNCY_BALL", "CONWAY_ALIVE", "CONWAY_DEAD",
	"BLOOD", "MUSCLE", "BONE", "BONE_DUST", "EPIDERMIS", "INACTIVE_NEURON", "ACTIVE_NEURON", "CEREBRUM",
	"CORAL", "DEAD_CORAL", "ELDER_CORAL", "PETRIFIED_CORAL", "COMPRESSED_CORAL", "DEAD_COMPRESSED_CORAL", 
	"CORAL_STIMULANT", "CORAL_PRODUCER", "CORAL_CONSUMER", "GHOST_CORAL", "CORPOREAL_CORAL",
	"FLUORESCENCE", "DORMANT_FLUORESCENCE", "SCREEN_WIPE"
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
				//if A. the previouse block is not the same as the current block or
				//B. the duration is larger than 16 bits
				//then write a new line
				
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
					// buffer.write.unit16(cell.vel); //TODO add vel to save and load game
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
				// const vel = buffer.read.unit16(); //TODO add vel to save and load game
				const acts = buffer.read.int32();
				for (let i = 0; i < duration; i++) {
					const cell = save.grid[x][y];
					cell.id = idMap[id];
					cell.reference = idMap[reference];
					// cell.vel = vel;
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

const SAVE_FILE_PATH = "world.vand";

fileSystem.createFileType(WorldSave, ["sand", "vand"]);

class Cell {
	constructor(id) {
		this.id = id;
		this.updated = false;
		this.vel = Vector2.origin;
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
		this.worryCells = new Set();
		this.lastVelocity = Vector2.origin;
		this.lastAngularVelocity = 0;
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
	collideGeneral(obj, { element, contacts, direction }) {
		if (!this.collidingObjects.get(element)) {
			this.collidingObjects.set(element, 20);

			const mass = element => element.scripts.PHYSICS.mobile ? element.scripts.PHYSICS.mass : 0;
			const contactVelocity = (element, contact) => {
				if (!element.scripts.DYNAMIC_OBJECT) return 0;
				const { lastVelocity, lastAngularVelocity } = element.scripts.DYNAMIC_OBJECT;	
				return lastVelocity.plus(contact.minus(element.transform.position).normal.times(lastAngularVelocity)).dot(direction);
			};
			const m0 = mass(obj);
			const m1 = mass(element);
			const systemMass = m0 + m1;
			let momentum = 0;
			for (let i = 0; i < contacts.length; i++) {
				const contact = contacts[i];
				momentum += Math.abs(m0 * contactVelocity(obj, contact) - m1 * contactVelocity(element, contact));
			}

			// frequency scales with sqrt(mass)
			// volume scales with momentum

			// const frequency = 40 / (0.01 * Math.sqrt(systemMass));
			// const volume = momentum * 0.0005;

			// console.log(frequency, volume);

			// if (volume > 1e-1) synth.play({
			// 	duration: 10,
			// 	frequency,
			// 	volume,
			// 	wave: "sine",
			// 	fadeOut: 10
			// });
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
		const globalMin = Vector2.origin;
		const globalMax = new Vector2(WIDTH - 1, HEIGHT - 1);
		const min = Vector2.clamp(Vector2.floor(bounds.min), globalMin, globalMax);
		const max = Vector2.clamp(Vector2.ceil(bounds.max), globalMin, globalMax);
		const c = Vector2.origin;
		const local = Vector2.origin;
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
		const skip = Vector2.origin;
		const vertex = Vector2.origin;

		for (c.x = min.x; c.x <= max.x; c.x++) {
			if (c.x > topCutoff) top = topEdgeRight;
			if (c.x > bottomCutoff) bottom = bottomEdgeRight;
			const minY = Math.max(Math.floor(top.evaluate(c.x)), min.y);
			const maxY = Math.min(Math.ceil(bottom.evaluate(c.x)) - 1, max.y);
			c.y = minY;
			toLocal.times(c, local);
			for (; c.y <= maxY; c.y++) {
				local.add(localDY);
				const lx = Math.floor(local.x);
				const ly = Math.floor(local.y);
				const cell = grid[lx]?.[ly];
				if (cell?.id) fn(cell, c.x, c.y, lx, ly);
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
			const minCellX = minX * DYNAMIC_OBJECT.RES;
			const minCellY = minY * DYNAMIC_OBJECT.RES;

			const edges = shape.getEdges()
				.filter(edge => edge.a.x !== edge.b.x);

			
			for (let i = minX; i <= maxX; i++) {
				const stops = edges
					.filter(edge => edge.a.x > edge.b.x ? edge.b.x <= i && i < edge.a.x : edge.a.x <= i && i < edge.b.x)
					.map(edge => edge.a.y === edge.b.y ? edge.a.y : edge.evaluate(i))
					.sort((a, b) => a - b);
	
				for (let n = 0; n < stops.length; n += 2) {
					const startY = Math.max(minY, Math.floor(stops[n]) - 1);
					const endY = Math.ceil(stops[n + 1]);
					for (let j = startY; j <= endY; j++) {
						for (let ii = 0; ii < DYNAMIC_OBJECT.RES; ii++)
						for (let jj = 0; jj < DYNAMIC_OBJECT.RES; jj++) {
							const x = i * DYNAMIC_OBJECT.RES + ii;
							const y = j * DYNAMIC_OBJECT.RES + jj;
							if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
								grid[x - minCellX][y - minCellY] = this.grid[x][y];
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
		rb.mobile = !paused || keyboard.justPressed("Enter");
		this.lastVelocity = rb.velocity.get();
		this.lastAngularVelocity = rb.angularVelocity;
		for (const [key, count] of this.collidingObjects) {
			this.collidingObjects.set(key, Math.max(0, count - 1));
		}
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

// here! alert(chunks[1][14])

const CHUNK_WIDTH = chunks.length;
const CHUNK_HEIGHT = chunks[0].length;

const lastIds = Array.dim(WIDTH, HEIGHT)
	.fill(TYPES.AIR);


class Element {
	static DEFAULT_PASSTHROUGH = new Set([TYPES.AIR]);
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

			if (!this.onburn(x, y)) { 
				Element.setCell(x, y, fireType);
			} else {
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
			if(x === ox && y === oy) return true;
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
					if(Math.round(i + x1) === x && Math.round(j + y1) === y) return true;
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

	static getNeighborsOfTypes(x, y, set) {
		return [
			Element.isTypes(x, y - 1, set),
			Element.isTypes(x + 1, y - 1, set),
			Element.isTypes(x + 1, y, set),
			Element.isTypes(x + 1, y + 1, set),
			Element.isTypes(x, y + 1, set),
			Element.isTypes(x - 1, y + 1, set),
			Element.isTypes(x - 1, y, set),
			Element.isTypes(x - 1, y - 1, set)
		];
	}

	static inBounds(x, y) {
		return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
	}

	static react(x, y, reactant, product, chance = 1, cardinal = false) {
		let reacted = false;
		if(cardinal){
			Element.affectCardinalNeighbors(x, y, (ox, oy) => {
				if (Element.isType(ox, oy, reactant) && Random.bool(chance)) {
					Element.setCell(ox, oy, product);
					reacted = true;
				}
			});
			return reacted;
		}
		else {
			Element.affectAllNeighbors(x, y, (ox, oy) => {
				if (Element.isType(ox, oy, reactant) && Random.bool(chance)) {
					Element.setCell(ox, oy, product);
					reacted = true;
				}
			});
			return reacted;
		}
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

	static affectCardinalNeighbors(x, y, effect) {
		for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
			const ox = x + i;
			const oy = y + j;
			if ((ox === x || oy === y) && (i || j) && Element.inBounds(ox, oy) && grid[ox][oy].id !== TYPES.AIR)
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

	static isEmptyReference(x, y, set = Element.DEFAULT_PASSTHROUGH) {
		return Element.inBounds(x, y) && set.has(grid[x][y].id);
	}


	static isEmpty(x, y, set = Element.DEFAULT_PASSTHROUGH) {
		if (Element.inBounds(x, y)) {
			let id = grid[x][y].id;
			if (DATA[id].reference) {
				// if (grid[x][y].reference === TYPES.AIR) {
				// 	return false;
				// }
				if (set.has(id)) return true; // this line doesn't really do anything, is this meant to have the reference id?
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

	static ORThreeCheck(x, y, element) {
		return Element.isType(x, y, element) ||
			Element.isType(x + 1, y, element) ||
			Element.isType(x - 1, y, element);
	}

	static ORThreeChecks(x, y, elements) {
		return Element.isTypes(x, y, elements) ||
			Element.isTypes(x + 1, y, elements) ||
			Element.isTypes(x - 1, y, elements);
	}

	static touching(x, y, element) {
		let t = false;
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if(Element.isType(ox, oy, element)) t = true;;
		})
		return t;
	}

	static touchingMany(x, y, elements) {
		let t = false;
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if(Element.isTypes(ox, oy, elements)) t = true;;
		})
		return t;
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

	static permeateDye(x, y, permeator, permeatee, violence = 5) {
		try {
			let ox = x;
			let d = 1;
			let c = grid[x][y-1].id;

			while (Element.isType(ox, y + d, permeator)) {
				d++;
				let p = Random.perlin(y + d + intervals.frameCount, 0.25, x);
				ox += Math.round(Number.remap(p, 0, 1, -violence, violence));
			}

			if (Element.inBounds(ox, y + d) && Element.isType(ox, y + d, permeatee)) {
				Element.setCell(ox, y + d, permeator);
				grid[ox][y + d].reference = c;
				if (Element.isTypes(x, y - 1, LIQUID)) Element.die(x, y - 1);
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

const GAS = new Set([TYPES.STEAM, TYPES.SMOKE, TYPES.ESTIUM_GAS, TYPES.HYDROGEN, TYPES.DDT, TYPES.INCENSE_SMOKE, TYPES.CONWAY_ALIVE, TYPES.WATER_VAPOR]);
const OTHER_GAS = new Set([TYPES.AIR, ...GAS]);
const LIQUID = new Set([TYPES.CONDUCTIVE_FLUID, TYPES.WATER, TYPES.POND_WATER, TYPES.LAVA, TYPES.POWER_LAVA, TYPES.GREEN_LAVA, TYPES.BLOOD, TYPES.ESTIUM, TYPES.DECUMAN_GLAZE, TYPES.GLAZE_BASE, TYPES.OIL, TYPES.LIQUID_COPPER, TYPES.LIQUID_IRON, TYPES.LIQUID_LEAD, TYPES.LIQUID_GOLD, TYPES.GENDERFLUID, TYPES.ACID, TYPES.HONEY, TYPES.MOLTEN_WAX, TYPES.SALT_WATER]);
const GAS_PASSTHROUGH = new Set([TYPES.AIR, TYPES.FIRE, TYPES.BLUE_FIRE, TYPES.SPIRAL_FIRE, TYPES.MAGNESIUM_FIRE]);
const LIQUID_PASSTHROUGH = new Set([...GAS_PASSTHROUGH, ...GAS]);
const WATER_PASSTHROUGH = new Set([...LIQUID_PASSTHROUGH, TYPES.OIL, TYPES.ESTIUM]);
const SALT_WATER_SWAP_PASSTHROUGH = new Set([TYPES.WATER, TYPES.POND_WATER]);
const POND_WATER_SWAP_PASSTHOUGH = new Set([TYPES.WATER, TYPES.SALT_WATER]);
const SOLID_PASSTHROUGH = new Set([...LIQUID_PASSTHROUGH, ...LIQUID]);
const SOLID = new Set(Object.values(TYPES));
SOLID.delete(TYPES.PARTICLE);
for (const type of SOLID_PASSTHROUGH)
	SOLID.delete(type);
SOLID.delete(TYPES.RUST);
SOLID.delete(TYPES.ASH);
SOLID.delete(TYPES.WATER_VAPOR);
SOLID.delete(TYPES.GRAINY_WAX);
const PARTICLE_PASSTHROUGH = new Set([...SOLID_PASSTHROUGH, TYPES.PARTICLE]);
const ALL_PASSTHROUGH = new Set(Object.values(TYPES));
const WATER_TYPES = new Set([TYPES.WATER, TYPES.SALT_WATER, TYPES.POND_WATER, TYPES.WATER_VAPOR, TYPES.CONDUCTIVE_FLUID]);
const GLAZE_TYPES = new Set([TYPES.GLAZE_BASE, TYPES.DECUMAN_GLAZE])
const ANT_UNSTICKABLE = new Set([TYPES.GENDERFLUID, TYPES.COPPER, TYPES.HIGH_EXPLOSIVE, TYPES.LIQUID_COPPER, TYPES.IRON, TYPES.LIQUID_IRON, TYPES.LEAD, TYPES.LIQUID_LEAD, TYPES.ESTIUM_GAS, TYPES.STEEL, TYPES.BRICK, TYPES.MUSCLE, ...WATER_TYPES]);
const CONDUCTIVE = new Set([TYPES.CONDUCTIVE_FLUID, TYPES.COPPER_BRICKS, TYPES.GENDERFLUID, TYPES.LIGHT_SAD, TYPES.COPPER, TYPES.GOLD, TYPES.AUREATE_DUST, TYPES.LIQUID_GOLD, TYPES.HIGH_EXPLOSIVE, TYPES.LIQUID_COPPER, TYPES.LEAD, TYPES.LIQUID_LEAD, TYPES.ESTIUM_GAS, TYPES.STEEL, TYPES.BRICK, TYPES.IRON, TYPES.CONWAY_DEAD, TYPES.MUSCLE, ...WATER_TYPES]);
const ELECTRICITY_PASSTHROUGH = new Set([...CONDUCTIVE,TYPES.GERMANIUM, TYPES.ELECTRICITY, TYPES.BLUE_ELECTRICITY, TYPES.CONWAY_ALIVE]);
const SUGARY = new Set([TYPES.SUGAR, TYPES.HONEY, TYPES.CARMEL]);
const COLD = new Set([...WATER_TYPES, ...GLAZE_TYPES, TYPES.ICE, TYPES.BLOOD, TYPES.ESTIUM, TYPES.HONEY]);
const SOIL_TYPES = new Set([TYPES.DAMP_SOIL, TYPES.SOIL]);
const GRASS_ROOTABLE = new Set([...SOIL_TYPES, ...WATER_TYPES]);
const GRASS_GROWABLE = new Set([...GRASS_ROOTABLE, TYPES.GRASS, TYPES.ROOT]);
const CONVEYOR_RESISTANT = new Set([TYPES.CONVEYOR_LEFT, TYPES.CONVEYOR_RIGHT, TYPES.CONDENSED_STONE]);
const RADIATION_RESISTANT = new Set([TYPES.AIR, TYPES.RADIUM_GEM, TYPES.RADIUM, TYPES.ACTINIUM, TYPES.THORIUM, TYPES.LEAD, TYPES.LIQUID_LEAD, TYPES.CONDENSED_STONE]);
const NEURON = new Set([TYPES.INACTIVE_NEURON, TYPES.ACTIVE_NEURON])
const BRAIN = new Set([...NEURON, TYPES.CEREBRUM])
const MEATY = new Set([...BRAIN, TYPES.EPIDERMIS, TYPES.MUSCLE, TYPES.BLOOD])
const SUNFLOWER = new Set([TYPES.SUNFLOWER_PETAL, TYPES.SUNFLOWER_SEED, TYPES.SUNFLOWER_STEM])
const THICKETS = new Set([TYPES.THICKET, TYPES.INCENSE, TYPES.THICKET_BUD, TYPES.THICKET_SEED, TYPES.INCENSE_SMOKE, TYPES.THICKET_STEM]);
const ACID_IMMUNE = new Set([TYPES.ACID, TYPES.GLASS, TYPES.GHOST_CORAL, TYPES.BOUNCE_BEAM, TYPES.BOUNCE_GREEN_BEAM]);
const CORAL_ON = new Set([TYPES.CORAL, TYPES.ELDER_CORAL, TYPES.CORPOREAL_CORAL, TYPES.COMPRESSED_CORAL])
const CORAL_OFF = new Set([TYPES.DEAD_CORAL, TYPES.PETRIFIED_CORAL, TYPES.GHOST_CORAL, TYPES.DEAD_COMPRESSED_CORAL])
const INSECT = new Set([TYPES.BEE, TYPES.ANT, TYPES.DAMSELFLY, TYPES.MITE, TYPES.LIGHTNING_BUG, TYPES.TERMITE]);
const CREATURE = new Set([...INSECT, TYPES.MINNOW])
const BEE_BUILDABLE = new Set([TYPES.SUNFLOWER_STEM, TYPES.HIVE, TYPES.WOOD])
const MITE_EATABLE_DEFENDING = new Set([TYPES.BEE, TYPES.ANT, TYPES.HIVE])
const MITE_EATABLE = new Set([...MITE_EATABLE_DEFENDING, ...MEATY, ...THICKETS, ...SUGARY, ...CORAL_ON, ...SUNFLOWER, TYPES.DAMSELFLY, TYPES.MINNOW, TYPES.GRASS, TYPES.FLOWER, TYPES.ROOT, TYPES.LEAVES])
const ANTIMATTER_PASSTHROUGH = new Set([TYPES.AIR, TYPES.ANTIMATTER]);
const CORALS = new Set([...CORAL_OFF, ...CORAL_ON, TYPES.CORAL_CONSUMER, TYPES.CORAL_PRODUCER, TYPES.CORAL_STIMULANT]);
const GHOST_CORAL_UNREACTIVE = new Set([...CORALS, TYPES.GLASS, ...CONVEYOR_RESISTANT, TYPES.AIR]);
const GHOST_CORAL_REACT = new Set(Object.values(TYPES));
const GROUND = new Set([TYPES.STONE, TYPES.CONDENSED_STONE, TYPES.MARBLE]);

const TREE_PLACING_PASSTHROUGH = new Set([...SOLID_PASSTHROUGH, ...SUNFLOWER, ...THICKETS, TYPES.LEAVES])

const LIGHTNING_PASSTHROUGH = new Set([...LIQUID_PASSTHROUGH, TYPES.SAND]);
const CONWAY = new Set([TYPES.CONWAY_ALIVE, TYPES.CONWAY_DEAD])
const TERMITES = new Set([TYPES.ANT_HILL, TYPES.TERMITE]);
const TERMITE_FOOD = new Set([...SUGARY, ...CORAL_ON, TYPES.CORAL_STIMULANT, TYPES.BONE, TYPES.BONE_DUST, TYPES.SUNFLOWER_SEED]);
const TERMITE_EATABLE = new Set([...TERMITE_FOOD, TYPES.COTTON, TYPES.DYED_COTTON, ...MEATY, TYPES.SAND, TYPES.SUNFLOWER_PETAL]);

const RADIUM_SKIP = new Set([TYPES.BAHHUM, TYPES.TERMINATOR, ...CONWAY, TYPES.SCREEN_WIPE, TYPES.AIR])

GHOST_CORAL_UNREACTIVE.delete(TYPES.CORAL_STIMULANT);
GHOST_CORAL_REACT.delete(TYPES.PARTICLE);
for (const type of GHOST_CORAL_UNREACTIVE)
	GHOST_CORAL_REACT.delete(type);

const URANIUM_PASSTHROUGH = new Set(Object.values(TYPES));
URANIUM_PASSTHROUGH.delete(TYPES.URANIUM);

const TERMINATOR_UNREACTIVE = new Set([TYPES.TERMINATOR, TYPES.AIR, TYPES.LEAD]);
const HEAT = new Set([TYPES.FIRE,TYPES.BLUE_FIRE, TYPES.SPIRAL_FIRE, TYPES.MAGNESIUM_FIRE,TYPES.LAVA,TYPES.POWER_LAVA,TYPES.EXOTHERMIA]);
const FIRE_TYPES = new Set([TYPES.FIRE,TYPES.BLUE_FIRE, TYPES.SPIRAL_FIRE, TYPES.MAGNESIUM_FIRE]);

const GREEN_BEAM_PASSTHROUGH = new Set([...GAS_PASSTHROUGH, TYPES.BOUNCE_BEAM, TYPES.BOUNCE_GREEN_BEAM])

const GERMANIUM_PASSTHROUGH = new Set([TYPES.GERMANIUM]);

// const OVERWRITEABLE = new Set([TYPES.CONWAY_DEAD, TYPES.AIR, TYPES.ELECTRICITY])

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
		if (renderOnVel){
			tex.setPixel(x, y,)
		}else if (grid[x][y].id === TYPES.AIR)
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
	let moved = false;

	if (Element.tryMove(x, y, x, y + dy, passthrough)) {
		fell = true;
		moved = true;
	} else {
		if (vel.y > 5) {
			vel.rotate(Random.angle()).div(2);
			createParticle(new Vector2(x, y));
			soundEffects.rainSound.frequency++;
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
				moved = true;
			} else {
				if (Element.tryMove(x, y, x + d, y, passthrough)) {
					horiz = true;
					moved = true;
				} else {
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

	return moved;
};

function chaosUpdate(x, y, passthrough) {
	const angle = Random.angle();
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	if (!Element.tryMove(x, y, Math.round(x + cos), Math.round(y + sin), passthrough)) {
		Element.updateCell(x, y);
		return false;
	}
	return true;
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
	let cohesionV = Vector2.origin; //cohesion
	let separationV = Vector2.origin; //seperation
	let alignmentV = Vector2.origin;	//alignment
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

let fireScale = 2;

const fireUpdate = (x, y, type, up = true, down = false) => {	
	soundEffects.fireSound.frequency++;
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
		if (up || down) {
			let fy = 0;
			if (up) fy += (down) ? (Random.bool(0.5) ? -1 : 0) : -1;
			if (down) fy += (up) ? (Random.bool(0.5) ? 1 : 0) : 1;
			
			let d = Random.bool() ? -1 : 1;
			fy *= (down && up) ? fireScale + Math.round(8/oxygen) : 1;
			d *= (down && up) ? fireScale + Math.round(8/oxygen) : 1;
			
			if (Element.tryMove(x, y, x + d, y + fy));
			else if (Element.tryMove(x, y, x - d, y + fy));
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

const liquidUpdate = (x, y, sound = soundEffects.liquidSound, passthrough = LIQUID_PASSTHROUGH) => {
	if (fluidUpdate(x, y, 1, GRAVITY, passthrough)) {
		sound.frequency++;
	}
};

const gasUpdate = (x, y, passthrough = GAS_PASSTHROUGH) => {
	fluidUpdate(x, y, -1, 0, passthrough);
};

const solidUpdate = (x, y, g = GRAVITY, dxShiftChance = 0, tryMove = Element.tryMove) => {
	const { vel } = grid[x][y];
	vel.y += g;
	const dx = Random.bool(dxShiftChance) ? (Random.bool(.5) ? -1 : 1) : 0;
	const dy = 1 + Math.round(vel.y);
	if (tryMove(x, y, x + dx, y + dy, SOLID_PASSTHROUGH));
	else {
		const d = Random.bool() ? -1 : 1;
		if (tryMove(x, y, x - d, y + dy, SOLID_PASSTHROUGH));
		else if (tryMove(x, y, x + d, y + dy, SOLID_PASSTHROUGH));
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



function makeLine(x, y, x1, y1, id, r = 10, chance = 0.2, passthrough = ALL_PASSTHROUGH) {
	const minX = Math.min(x, x1) - r;
	const minY = Math.min(y, y1) - r;
	const maxX = Math.max(x, x1) + r;
	const maxY = Math.max(y, y1) + r;
	const line = new Line(x, y, x1, y1);
	for (let i = minX; i <= maxX; i++) for (let j = minY; j <= maxY; j++) {
		const p = new Vector2(i, j);
		if (Element.inBounds(i, j) && line.distanceTo(p) < r) {
			if(id === "explode") explode(i, j, 1)
			else Element.trySetCell(i, j, id, passthrough);
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


const EXPLOSION_PASSTHROUGH = new Set([...LIQUID_PASSTHROUGH, TYPES.LIGHTNING, TYPES.AIR]);
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

function explode(ox, oy, r = 10, vel = 0.2, passthrough = EXPLOSION_PASSTHROUGH, sound = true) {
	const c = Math.PI * 2 * r;

	if(sound) eventSoundEffects.explosionSound.frequency++;

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

//up down left right, top right, top left, bottom right, bottom left
const directionArray = [[0,1],[0,-1],[-1,0],[1,0],[1,1],[-1,1],[1,-1],[-1,-1]];

const timeConversionAmount = 1;
const pheromoneAge = 5000;
const maxPheromoneAge = 5000; 
let points = 0;

function readBitfield(field, index, size) {
	return (field >> index) & ((1 << size) - 1);
}

function antBytePlacer(toHome, toFood, toHomeValue = 0, toFoodValue = 0){ //note they pass in the array
	let out = 0;
	let time = simFrameCount/timeConversionAmount;
	time = Math.min(0xffff >> 1, time);
	toHomeTime = time << 1;
	toFoodTime  = time << 17;
	out |= (toHome) ? toHomeTime | (+toHome) : (toHomeValue << 1);
	out |= (toFood) ? toFoodTime | ((+toFood) << 16) : (toFoodValue << 16);
	// out = toHomeTime | toFoodTime | (+toHome) | ((+tosFood) << 16);
	return out;
}

function antBytePlacerNew(toHome, toFood, toHomePherArr = [0, 0], toFoodPherArr = [0, 0]){ //note they pass in the array
	let out = 0;
	let time = simFrameCount/timeConversionAmount ;
	time = Math.min(0xffff >> 1, time);
	
	//why not make the 16 bit chunk then shift it over at the end
	let toFoodTime  = (((toFood) ? time : Math.min(0xffff >> 1, toFoodPherArr[0])) << 1) | (toFood ? 1 : toFoodPherArr[1]);//this is 17 because time is stored as 15 bits (made via the math.min above), actually
	out |= toFoodTime << 16;
	// out <<= 16;

	let toHomeTime  = (((toHome) ? time :  Math.min(0xffff >> 1, toHomePherArr[0])) << 1) | (toHome ? 1 : toHomePherArr[1]);//this is 17 because time is stored as 15 bits (made via the math.min above), actually
	out |= toHomeTime;
	
	
	// out = toHomeTime | toFoodTime | (+toHome) | ((+tosFood) << 16);
	
	return out;
}

function antBytePaser(binary){
	//1111 1111 1111 1111
	//1111 1111 1111 1111

	//0000 0000 0000 0000

	//right most digit is the "activator"
	//everything else is time
	//of the 2 bytes for storage

	// let toHome = binary & 0xffff;
	// let toFood = (binary >> 16) & 0xffff;

	let toHome = readBitfield(binary, 0, 16);
	let toFood = readBitfield(binary, 16, 16);
	// if (toHome & 1){
		let isActiveHome = toHome & 1;
		toHome >>= 1;
		toHome *= timeConversionAmount;
		
	// } else toHome = 0;

	// if (toFood & 1){
		let isActiveFood = toFood & 1;
		
		toFood >>= 1;
		toFood *= timeConversionAmount;
	// } else toFood = 0;
	return [[toHome,isActiveHome], [toFood, isActiveFood]];
}

const maxValue = 1000000


function antPheromoneValue(pheromoneArr, currTime = simFrameCount){
	if (!pheromoneArr[1]) return 0; //if it is not active

	let tDiff = currTime - (pheromoneArr[0]);
	tDiff = Math.max(1, Math.min(1000000, tDiff));
	// if (tDiff > maxPheromoneAge) {
	// 	return 0;
	// }

	let score = maxValue - (tDiff) * pheromoneAge;
	// let score  = 1/(Math.round(tDiff)+1) * pheromoneAge
	score = Math.max(0, Math.min(1000000, score));

	return score;
	// if (time == 0 || time > 10000) {
	// 	return 0;
	// }
	// const tDiff = currTime - time;
	// let value = -tDiff + 10000; //temp equation
	// value = Math.max(Math.min(value, 10000), 0);
	// return value;
}

const toHomeWeight = 3;
const toFoodWeight = 3;


const antCheck = (x, y, angle, vel, isWandering = true) =>{
	let delta = vel.rotated(angle);
	let checkedCell = relGridGet(x, y, delta)
	if (checkedCell.id != TYPES.AIR) return -1;
	// console.log("acts please not be zero: "+checkedCell.acts);
	let pheromones = antBytePaser(checkedCell.acts);
	return antPheromoneValue((isWandering) ? pheromones[1] : -pheromones[0]) * 5000; //the 5000 shouldn't actually need to be here at all... 
	//this will return toHome strength if isWandering is set to false

	//maybe do a weighted check, that way the returning ones follow a path too? 
	// strength += (!isWandering) ? antPheromoneValue(pheromones[0]) : 0;
	// strength += (isWandering) ? antPheromoneValue(pheromones[1]): 0; 
	// return(strength);
};

const relGridGet = (x, y, vector) => {
	if (Element.isEmpty(x + Math.round(vector.x), y + Math.round(vector.y)))
	return grid[x + Math.round(vector.x)][y + Math.round(vector.y)];
	else return grid[x][y];
};

let antTestingValue = -65536; 


//fireAnt data

const getFireAntData = (x, y) => {
    
};


const DATA = {
	[TYPES.AIR]: new Element(0, Color.BLANK),

	[TYPES.TEST]: new Element(1, (x, y) => {
		const angle = Random.perlin2D(x, y, 0.005) * Math.PI * 2;
		const vec = new Vector2(x, y).rotate(angle);
		const mod = (a, b) => (a % b + b) % b;
		return mod(vec.y, 5) < 1 ? Color.alpha(Color.RED, 40 / 255) : new Color(100, 100, 100, Color.EPSILON);

	}, 0, 0, (x, y) => {
		const v = grid[x][y].vel;
		if (Element.threeChecks(x, y + 1, SOLID_PASSTHROUGH)) {
			const c = Random.range(0, Math.PI);
			v.x = Math.cos(c);
			v.y = Math.sin(c);
		}
		Element.tryMove(x, y, Math.round(x + v.x), Math.round(y + v.y), SOLID_PASSTHROUGH)
	}),
	
	//first test element, after element: (acts, color script, unknown, burning speed, interval script, burning script)
	[TYPES.URANIUM]: new Element(1, (x, y) => {
		//color script
		return Color.alpha(new Color("#6a00ff"),0.1); //change the glow of a material based on the alpha
	}, 0, 0, (x, y) => {
		//interval update script
	}),

	//liquid testing
	[TYPES.ORANGEJUICE]: new Element(1, (x, y) => {
		//color script
		return Color.alpha(new Color("#ffa200"),1); //change the glow of a material based on the alpha, although it is transparent
	}, 0, 0, (x, y) => {
		//interval update script
		//nothing too special here, to make the liquid react add other stuff to it!
		liquidUpdate(x,y);
	}),

	//dust / powder testing (solid but effected by grav)
	[TYPES.POWDER]: new Element(1, (x, y) => {
		//color script
		return Color.alpha(new Color("#00ff22"),0); //change the glow of a material based on the alpha
	}, 0, 0, (x, y) => {
		//interval update script
		//solid update syntax: x,y , effect of gravity, distance the particle will shift randomly while in air
		solidUpdate(x,y,0,1);
	}),

	[TYPES.OXYGEN]: new Element(1, (x, y) => {
		//color script
		return Color.alpha(new Color("#b3fff7"),0); //change the glow of a material based on the alpha
	}, 0, 0, (x, y) => {
		//interval update script
		//yet again nothing special add other stuff here
		gasUpdate(x,y);
	}),

	[TYPES.BURNING_BRICKS]: new Element(1, (x, y) => {
		//color script
		//copied from bricks
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
		const color = Random.bool() ? new Color("#a32a2101") : new Color("#a33b2101");
		
		//two things it returns in the colorscale, the icon color and the material color (which is generated by the perlin noicse generator)
		return Color.colorScale(
			color,
			Number.remap(
				Random.perlin2D(Math.floor(x / W), Math.floor(y / H)),
				0, 1, 0.5, 0
			)
		);

	}, 0, 0.1, (x, y) => {
		//interval update script
		//you can also do ()=>null
	},(x,y)=>{
		//this is the burning script, its after the interval update script
		Element.trySetCell(x,y-1,TYPES.BRICK); //you can add a pass through so if its water pass through it will place it even if there is water above it
		//this is done via: 
		//Element.trySetCell(x,y-1,TYPES.STONE,ALL_PASSTHROUGH);
		//I think
		//OKAY IMPORTANT the values before the interval update script seem to effect how burning works
		//more specifically the second value effects the speed of the burning
		//I am unsure if the first value is for rendering or interval update or some other thing
	}),
	
	[TYPES.COPPER_BRICKS]: new Element(1, (x, y) => {
		//color script
		//copied from bricks
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
		const color = Random.bool() ? new Color("#a32a2101") : new Color("#a33b2101");
		
		//two things it returns in the colorscale, the icon color and the material color (which is generated by the perlin noicse generator)
		return Color.colorScale(
			color,
			Number.remap(
				Random.perlin2D(Math.floor(x / W), Math.floor(y / H)),
				0, 1, 0.5, 0.5
			)
		);

	}, 0, 0.1, (x,y)=>{},(x,y)=>{
		Element.trySetCell(x,y-1,TYPES.CONDENSED_STONE,ALL_PASSTHROUGH);
		//there is a boolean argument after this but I have no clue what it does
	}),
	
	[TYPES.TERMINATOR]: new Element(0,(x,y)=>{
		const angle = Random.perlin2D(x, y, 0.01) * Math.PI * 2;
		const vec = new Vector2(x, y).rotate(angle);
		const mod = (a, b) => (a % b + b) % b;
		return mod(vec.y, 5) < 1 ? Color.alpha(Color.LIME, 40/255):Color.alpha(Color.PURPLE, 1 / 255);
	},0,0,(x,y)=>{
		const cell = grid[x][y];
		Element.updateCell(x,y);
		Element.affectAllNeighbors(x,y,(ox, oy) => {
			if(Element.isType(ox,oy,TYPES.BAHHUM)){
				makeCircle(x,y,TYPES.ACID,5);
			}  
			if (Element.isType(ox, oy, TYPES.SPIRAL_FIRE) && Random.bool(0.35)){
				makeCircle(ox, oy, TYPES.ANTIMATTER, 2, 1, TERMINATOR_UNREACTIVE);
			} else
			if(Element.isType(ox, oy, TYPES.ICE)&& cell.acts<100 && Random.bool((1/cell.acts))){
				makeCircle(x, y, TYPES.ICE,2,1,TERMINATOR_UNREACTIVE);
			} else if (!Element.isTypes(ox, oy, TERMINATOR_UNREACTIVE)) { //change the cell acts value here to change how long until the wire can eat
				cell.acts -=15;
				//if ((Random.bool(Random.perlin2D(x, y, 100) / 200))) 
				Element.setCell(ox,oy, TYPES.AIR);
				if((Random.bool(.05))){makeCircle(x,y,TYPES.TERMINATOR,7)}
			}
			
		});
		if(cell.acts >= 250){ //this checks if A. the cell has eaten or if the cell is too old
			Element.setCell(x,y,TYPES.AIR);
		}
		cell.acts++;
		const moveMax = 250;
		const moveMin = 0;
		const v = cell.vel;
		let movement_chaos = Math.max(Math.min(Math.trunc((260)/cell.acts),moveMax),moveMin); //change this to change how much movement is varied deafult is 250
		v.x = ((2*Random.bool()-1)*movement_chaos);
		v.y = ((2*Random.bool()-1)*movement_chaos);
		Element.tryMove(x,y,Math.round(x+v.x),Math.round(y+v.y), LIQUID_PASSTHROUGH);
		//to get them to be super chaotic change movement chaos to be depenent on the cell.acts value.
	},(x, y) => null),

	[TYPES.FLASH_PAPER]: new Element(1, [new Color("#edebe1"), new Color("#f4f5df"), new Color("#cfbba3")], 0, 1, (x, y) => {
		Element.consumeReact(x, y, TYPES.WATER, TYPES.WET_PAPER);
	},(x,y)=>{
		Element.trySetCell(x, y - 1, Random.bool(.1) ? TYPES.ASH : TYPES.SMOKE);
	}),


	[TYPES.WET_PAPER]: new Element(1, [new Color("#edebe1"), new Color("#f4f5df"), new Color("#b8c4ad")] , 0.2, 0.25, (x, y) => {
		solidUpdate(x,y,0.2,0);
		if (Element.isType(x, y - 1, TYPES.WATER)) {
			Element.permeate(x, y, TYPES.WET_PAPER, TYPES.FLASH_PAPER, TYPES.WATER, 2);			
		}
	},(x,y)=>{
		Element.trySetCell(x,y-1,(Random.bool(0.5)) ? TYPES.FLASH_PAPER : TYPES.WATER);
	}),

	[TYPES.GERMANIUM]: new Element(1,(x,y)=>{
		return Color.alpha(new Color("#edebe1"),0);
	},0.4,0,(x,y)=>{
		//up down left right, top right, top left, bottom right, bottom left
		
		let reacted = false;
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (!reacted && Element.isTypes(ox, oy, HEAT)) {
				// let germID = grid[x][y].id;
				Element.setCell(x,y,TYPES.ACTIVE_GERMANIUM);
				let positionArr = [ox-x,oy-y];
				grid[x][y].vel = new Vector2(ox-x,oy-y).mul(-1);
				// grid[x,y].acts = directionArray.findIndex([ox-x,oy-y]);
				Element.die(ox, oy);
				reacted = true;
			}
		});
	}),

	[TYPES.ACTIVE_GERMANIUM]: new Element(0,(x,y)=>{
		return Color.alpha(new Color("#0062ff"), 0.75);
	},0.4,0,(x,y)=>{


		let cell = grid[x][y];
		if (cell.vel.mag == 0) {
			cell.vel = new Vector2(Random.int(-1,1), Random.int(-1,1));
		}
		
		if (!Element.tryMove(x,y,x+ cell.vel.x,y+ cell.vel.y,GERMANIUM_PASSTHROUGH)) {
			Element.setCell(x,y,TYPES.ELECTRICITY);
			grid[x][y].reference = TYPES.GERMANIUM;
		}

		// console.log("made move arr: "+moveArr);
		// if(Element.isType(x+moveArr[0],y+moveArr[1],TYPES.GERMANIUM)){
		// 	console.log("germanium detected");
		// }
		// let hasMoved = Element.tryMove(x,y,x+moveArr[0],y+moveArr[1],GERMANIUM_PASSTHROUGH);
		// // console.log("moved : "+cell.acts);

		// if(!hasMoved){
		// 	// console.log("generating elec");
		// 	Element.setCell(x,y,TYPES.ELECTRICITY);
		// 	// console.log("elec made");
		// 	grid[x][y].reference = TYPES.GERMANIUM;
		// }else{
		// 	// console.log("changing refrence");
		// 	grid[x+moveArr[0]][y+moveArr[1]].acts = cell.acts;
		// 	Element.setCell(x,y,TYPES.GERMANIUM);
		// }
		// Element.move(x,y,x+1,y+1);
		// move through germanium in the direction shown then at the end it will turn into electricity and reconstruct
		// also what about a element that reacts to electricty by replacing it creating a trail
		// directional travel
				
	}),

	[TYPES.BOID]: new Element(1, (x, y) => {
		return Color.alpha(new Color("#b3fff7"),0);
	}, 0, 0.1, (x,y)=>{
		if (Element.isTypes(x,y+1,SOLID_PASSTHROUGH)) {
		const v = grid[x][y].vel;
			//FIXME after addign this the website loads inconsistently
			v.y = (v.y > 10) ? v.y+1 : v.y+1; //FIXME there seems to be a weird error where if you just have v.y += 1; v.x += 1; it will crash inconsistentally
			
			// v.x += Random.bool(0.6) ? 0.5 : -1;
			Element.tryMove(x, y, Math.round(x + v.x), Math.round(y + v.y), SOLID_PASSTHROUGH);
			console.log(v);
		}
		
	},(x,y)=>{
		Element.trySetCell(x,y-1,TYPES.CONDENSED_STONE,ALL_PASSTHROUGH);
		
		//there is a boolean argument after this but I have no clue what it does
	}),

	// [TYPES.GREEN_FIRE]: new Element(140, [new Color("#1db55c"), new Color("#598f29"), new Color("#32a852"), new Color("#005230"), new Color("#37d622")], 0, 0, (x, y) => fireUpdate(x, y, TYPES.GREEN_FIRE, true, true)),

	[TYPES.SPIRAL_FIRE]: new Element(140, [new Color("#1db55c"), new Color("#598f29"), new Color("#32a852"), new Color("#005230"), Color.MOLLY],
	1, 0, (x, y) => {
		const fireViolence = 4; //lower valeus == more burning
		let burned = false;
		let neighbors = 0;
		let oxygen = 0;
		let meat = 0;
		let intensity = 0.9;
		cell = grid[x][y];
		cell.vel = Vector2.fromAngle(cell.vel.angle + ((Math.sign(cell.vel.angle - Math.PI)) ? -intensity : intensity) * (Random.angle() / 4)).times(Random.range(1, 2));
		
		Element.consumeReact(x, y, TYPES.ACTIVE_NEURON, TYPES.SPIRAL_FIRE);
		Element.consumeReact(x, y, TYPES.ASH, TYPES.AIR);

		// Element.consumeReactMany(x, y, GAS_PASSTHROUGH, TYPES.SPIRAL_FIRE);
		Element.consumeReactMany(x, y, LIQUID, TYPES.SPIRAL_FIRE, 0.05);
		Element.consumeReact(x, y, TYPES.LAVA, TYPES.GREEN_LAVA);
		Element.consumeReact(x, y, TYPES.POWER_LAVA, TYPES.GREEN_LAVA);


		Element.consumeReact(x, y, TYPES.STEAM, TYPES.AIR);

		Element.affectAllNeighbors(x, y, (X, Y)=>{
			if (Element.isTypes(X, Y, FIRE_TYPES) || Element.isTypes(X, Y, NEURON) || Element.isType(X, Y, TYPES.STEAM)) {
				Element.setCell(X, Y, TYPES.SPIRAL_FIRE);				
			}else if (Element.isTypes(X, Y, MEATY)){
				meat++;
			} else if (Element.isType(X, Y, TYPES.HIGH_EXPLOSIVE) || Element.isType(X, Y, TYPES.EXPLOSIVE) || Element.isType(X, Y, TYPES.EXPLOSIVE_DUST)){
				Element.setCell(X, Y, TYPES.SPIRAL_FIRE);
				if (Random.bool(.50)) explode(x, y, Random.int(5, 40));
				makeCircle(x, y, TYPES.SPIRAL_FIRE, 10)

			}
			if (Element.isEmpty(X, Y))
				oxygen++;
			else {
				if (Element.tryBurn(X, Y, TYPES.SPIRAL_FIRE))
					burned++;
				neighbors++;
			}
		})

		if (meat > 3 && Random.bool(0.01)){
			makeCircle(x, y, TYPES.SPIRAL_FIRE, 2);
		}

		if ((!burned && Random.bool(0.015)))
			Element.die(x, y);
		// if (burned) Element.die(x,y);
		// if (burned >= fireViolence){
		// 	// makeCircle(x, y, TYPES.SPIRAL_FIRE, 5, 0.5);
		// }
		cell.vel.mag = 2 * (oxygen / 4.5);
		// cell.vel.mag = Math.max(Math.min(cell.vel.mag, 0), 5);
		if (neighbors < 7)
			Element.tryMove(x, y, Math.round(x + cell.vel.x), Math.round(y + cell.vel.y));
		Element.updateCell(x,y);
	}),

	// [TYPES.GREEK_FIRE]: new Element(140, [new Color("#1db55c"), new Color("#598f29"), new Color("#32a852"), new Color("#005230"), Color.MOLLY],
	// 1, 0, (x, y) => {
    //     const fireViolence = 4; //lower valeus == more burning
    //     let burned = false;
    //     let neighbors = 0;
    //     let oxygen = 0;
    //     cell = grid[x][y];
    //     cell.vel = Vector2.fromAngle(cell.vel.angle + ((Math.sign(cell.vel.angle - Math.PI)) ? -1 : 1) * (Random.angle() / 4)).times(Random.range(1, 2));

    //     Element.affectAllNeighbors(x, y, (X, Y)=>{
    //         if (Element.isEmpty(X, Y))
    //             oxygen++;
    //         else {
    //             if (Element.tryBurn(X, Y, TYPES.SPIRAL_FIRE))
    //                 burned++;
    //             neighbors++;
    //         }
    //     })
    //     if ((!burned && Random.bool(0.025)))
    //         Element.die(x, y);
    //     // if (burned) Element.die(x,y);
    //     if (burned >= fireViolence){
    //         makeCircle(x, y, TYPES.SPIRAL_FIRE, 5, 0.5);
    //     }
    //     cell.vel.mag = 2 * (oxygen / 6.5);
    //     if (neighbors < 7)
    //         Element.tryMove(x, y, Math.round(x + cell.vel.x), Math.round(y + cell.vel.y));
    //     Element.updateCell(x,y);
    // }),

	[TYPES.GREEN_LAVA]: new Element(100, [Color.LIME, Color.GREEN, Color.TOBIN], 0.7, 0, (x, y) => {
		liquidUpdate(x, y);

		Element.react(x, y - Math.floor((Math.random() * Random.range(0,3))), TYPES.AIR, TYPES.SPIRAL_FIRE, 0.005);
		Element.reactMany(x, y, WATER_TYPES, TYPES.HYDROGEN, 0.25);
		let reacted = Element.react(x, y, TYPES.LAVA, TYPES.GREEN_LAVA);
		reacted += Element.react(x, y, TYPES.POWER_LAVA, TYPES.GREEN_LAVA);
		reacted += Element.reactMany(x, y, WATER_TYPES, TYPES.MAGNESIUM_FIRE);

		
		if(reacted) {
			Element.updateCell(x, y);
		}
		if (Random.bool(.5)) Element.react(x, y, TYPES.STONE, TYPES.SMOKE);
		if (Random.bool(.3)) Element.react(x, y, TYPES.GLASS, TYPES.HYDROGEN);
		if (Random.bool(.5)) Element.react(x, y, TYPES.SUGAR, Random.bool(0.75) ? TYPES.STEAM : TYPES.GREEN_LAVA);

		// Element.affectNeighbors(x, y, (ox, oy) => {
		// 	if (Element.isType(ox, oy, TYPES.CORPOREAL_CORAL)) Random.bool(.6) ? Element.setCell(x, y, TYPES.AUREATE_DUST) : Element.setCell(x, y, TYPES.GOLD);
		// })

		lavaUpdate(x, y, TYPES.SPIRAL_FIRE);
	}),

	[TYPES.URANIUM]: new Element(0, (x, y) => {
		let acts = grid[x][y].acts+1;
		let actsColor = Math.round((acts/15)*255);
 		let color = new Color(Math.round(actsColor/2), actsColor, Math.round(actsColor/2), 0);
		return color;
	}, 0.7, 0, (x, y) => {
		const maxValue = 15;
		// solidUpdate(x, y, GRAVITY * 0.2, 0.05, (x, y, fx, fy, j) => Element.tryMove(x, y, fx, fy, ALL_PASSTHROUGH));
		if(grid[x][y] < 5){
			gasUpdate(x, y, ALL_PASSTHROUGH);
		} else {
			liquidUpdate(x, y, undefined, ALL_PASSTHROUGH);
		}
		if (Random.bool(0.01)) {
			grid[x][y].acts++;
			// lastIds[x][y] = TYPES.PLACEHOLDER;
			updatePixel(x, y);
		}	
		// if (grid[x][y].acts > maxValue){
		// 	Element.setCell(x, y, TYPES.STEAM);		
		// }
		Element.updateCell(x, y);
	}),

	[TYPES.PLACEHOLDER]: new Element(0, new Color(0,0,0,0)),

	
	[TYPES.EXOTHERMIA]: new Element(1, (x, y) => {
		if (y === 0) return new Color("#b5193b");
		else if (y === 1) return new Color("#b52619");
		else if (y === 2) return new Color("#b33b30");
		else if (y === 3) return new Color("#bf5e3b");
		else if (y === 4) return new Color("#c9904b");
		else if (y === 5) return new Color("#cca85c");
		else if (y === 6) return new Color("#e0cc72");
		else if (y === 7) return new Color("#e8e280");
		else if (y === 8) return new Color("#f5f09a");
		else return new Color("#d7f8fa");
	}, 0, 0, (x, y) => {
		Element.die(x, y);
	}),

	[TYPES.BLOOD]: new Element(1, freqColoring([
		["#5c0404", 15],
		["#590404", 12]
	]), 0.4, 0.01, (x, y) => {
		liquidUpdate(x, y, soundEffects.liquidUpdate, WATER_PASSTHROUGH);
	}, (x, y) => {
		Element.setCell(x, y, Random.bool(.05) ? TYPES.ASH : Random.bool(.05) ? TYPES.STEAM : TYPES.SMOKE);
		if (Random.bool(.25)) Element.trySetCell(x, y - 1, TYPES.RUST);
		return true;
	}),

	[TYPES.BOUNCY_BALL]: new Element(0,(x, y)=>{
		const color = Color.alpha(new Color("#de1b86"),0);
		const layer = (x, y) => {
			const angle = Math.PI / 2;
			const c = Math.cos(angle);
			const s = Math.sin(angle);
			[x, y] = [x * c - y * s, x * s + y * c];
			y += Random.perlin(x, 5) * 3;
			const p = Random.voronoi2D(x, y, 0.1);
			return Color.colorScale(color, (1 - p) * 0.25 + 0.5);
		};
		return layer(x, y);
	}, 0.9, 0.4,(x, y)=>{
		const airResist = 0.1;
		const cellV = grid[x][y].vel;
		if (cellV.x == 0){
			cellV.x += (Random.bool(0.5)) ? -1 : 1;
		}
		cellV.mag = Number.clamp(cellV.mag, 0, 5);
		if (Element.isEmpty(Math.round(x + cellV.x), y, LIQUID_PASSTHROUGH)){
			cellV.x = -cellV.x;
		}
		if (Element.isEmpty(x, Math.round(y + cellV.y + GRAVITY), LIQUID_PASSTHROUGH)){
			cellV.y = -cellV.y;
		}
		cellV.y += 3*GRAVITY;

		Element.tryMove(x, y, Math.round(x + cellV.x), Math.round(y + cellV.y), LIQUID_PASSTHROUGH);
		Element.updateCell(x,y);
	}, (x, y)=>{
		if (Random.bool(0.99)) Element.trySetCell(x, y, TYPES.SMOKE);
		else Element.trySetCell(x, y, TYPES.ACID); 
	}),
	
	[TYPES.BOUNCE_BEAM]: new Element(0,(x,y)=>{
		const color = new Color("#de1b86");
		const layer = (x, y) => {
			const angle = Math.PI / 2;
			const c = Math.cos(angle);
			const s = Math.sin(angle);
			[x, y] = [x * c - y * s, x * s + y * c];
			y += Random.perlin(x, 5) * 3;
			const p = Random.voronoi2D(x, y, 0.1);
			return Color.colorScale(color, (1 - p) * 0.25 + 0.5);
		};
		return layer(x, y);
	}, 0, 0, (x,y) => {
		const cell = grid[x][y];
		if(cell.vel.mag == 0){
			// cell.vel = Vector2.fromAngle(Random.angle()).times(Random.range(3, 5));
			cell.vel.x = Random.bool(0.5) ? 1 : -1;
			cell.vel.y = Random.bool(0.5) ? 1 : -1;
		}

		if(!Element.inBounds(Math.round(x + cell.vel.x), y)) cell.vel.x *= -1;
		
		if(!Element.inBounds(x, Math.round(y + cell.vel.y))) cell.vel.y *= -1;

		if (Element.tryMove(x, y, Math.round(x + cell.vel.x), Math.round(y + cell.vel.y), ALL_PASSTHROUGH)) Element.die(x,y);
	}),

	[TYPES.BOUNCE_GREEN_BEAM]: new Element(0,(x,y)=>{
		const color = new Color("#00ffa6");
		const layer = (x, y) => {
			const angle = Math.PI / 2;
			const c = Math.cos(angle);
			const s = Math.sin(angle);
			[x, y] = [x * c - y * s, x * s + y * c];
			y += Random.perlin(x, 5) * 3;
			const p = Random.voronoi2D(x, y, 0.1);
			return Color.colorScale(color, (1 - p) * 0.25 + 0.5);
		};
		return layer(x, y);
	}, 0, 0, (x,y) => {
		const cell = grid[x][y];
		if(cell.vel.mag == 0){
			// cell.vel = Vector2.fromAngle(Random.angle()).times(Random.range(3, 5));
			cell.vel.x = Random.bool(0.5) ? 1 : -1;
			cell.vel.y = Random.bool(0.5) ? 1 : -1;
		}

		if(!Element.isEmpty(Math.round(x + cell.vel.x), y, GREEN_BEAM_PASSTHROUGH)) cell.vel.x *= -1;
		
		if(!Element.isEmpty(x, Math.round(y + cell.vel.y), GREEN_BEAM_PASSTHROUGH)) cell.vel.y *= -1;

		if(!Element.isEmpty(Math.round(x + cell.vel.x), Math.round(y + cell.vel.y), GREEN_BEAM_PASSTHROUGH)) {
			cell.vel.y *= -1;
			cell.vel.x *= -1;
		}
		
		if (Element.tryMove(x, y, Math.round(x + cell.vel.x), Math.round(y + cell.vel.y), GREEN_BEAM_PASSTHROUGH)) {
			Element.setCell(x, y, TYPES.BLUE_FIRE);
			// if (Random.bool(0.1)) makeCircle(Math.round(x - cell.vel.x), Math.round(y - cell.vel.y), TYPES.BLUE_FIRE, 2, 0.1);
		}
		Element.updateCell(x, y)
	}),

	[TYPES.GHOST_BEAM]: new Element(0,(x,y)=>{
		const color = new Color("#00ffa6");
		const layer = (x, y) => {
			const angle = Math.PI / 2;
			const c = Math.cos(angle);
			const s = Math.sin(angle);
			[x, y] = [x * c - y * s, x * s + y * c];
			y += Random.perlin(x, 5) * 3;
			const p = Random.voronoi2D(x, y, 0.1);
			return Color.colorScale(color, (1 - p) * 0.25 + 0.5);
		};
		return layer(x, y);
	}, 0, 0, (x,y) => {
		const cell = grid[x][y];
		if(cell.vel.mag == 0){
			// cell.vel = Vector2.fromAngle(Random.angle()).times(Random.range(3, 5));
			cell.vel.x = Random.bool(0.5) ? 1 : -1;
			cell.vel.y = Random.bool(0.5) ? 1 : -1;
		}

		if(!Element.isEmpty(Math.round(x + cell.vel.x), y, GREEN_BEAM_PASSTHROUGH)) cell.vel.x *= -1;
		
		if(!Element.isEmpty(x, Math.round(y + cell.vel.y), GREEN_BEAM_PASSTHROUGH)) cell.vel.y *= -1;

		if (Element.tryMove(x, y, Math.round(x + cell.vel.x), Math.round(y + cell.vel.y), GREEN_BEAM_PASSTHROUGH)) {
			Element.setCell(x, y, TYPES.BLUE_FIRE);
			// if (Random.bool(0.1)) makeCircle(Math.round(x - cell.vel.x), Math.round(y - cell.vel.y), TYPES.BLUE_FIRE, 2, 0.1);
		}
		else Element.updateCell(x, y)
	}, true),

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

			if (Random.bool(.022) && nearbyNeurons < 2 && nearbyNeurons1 === 1) {
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

		if (grid[x][y].acts === 0 && Element.isType(x, y, TYPES.ACTIVE_NEURON)) Element.react(x, y, TYPES.INACTIVE_NEURON, TYPES.ACTIVE_NEURON);
		if (grid[x][y].acts === 0 && Element.isType(x, y, TYPES.ACTIVE_NEURON)) Element.react(x, y, TYPES.DEAD_CORAL, TYPES.CORAL);
		if (grid[x][y].acts === strength) Element.setCell(x, y, TYPES.INACTIVE_NEURON);
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
			if (Element.isType(ox, oy, TYPES.BONE) && grid[ox][oy].acts === 2 && Random.bool(.001)) {
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
        grid[x][y].acts = 0
		Element.affectNeighbors(x, y, (ox, oy) => {
			if (Element.isTypes(ox, oy, MEATY) || Element.isType(ox, oy, TYPES.BONE)) m++;
			if (Element.isTypes(ox, oy, CONDUCTIVE) || Element.isType(ox, oy, TYPES.CORAL_STIMULANT)) grid[x][y].acts = 5
			if (Element.isType(ox, oy, TYPES.EPIDERMIS) && grid[ox][oy].acts > 0) {
                grid[x][y].acts = Math.max(grid[x][y].acts, grid[ox][oy].acts - 1) 
				Element.updateCell(x, y)
            }
		})
        if (grid[x][y].acts > 0) Element.react(x, y, TYPES.INACTIVE_NEURON, TYPES.ACTIVE_NEURON)
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

	[TYPES.BONE_DUST]: new Element(1, [new Color("#ebe5e4"), new Color("#fcefed")], .05, 0.01, (x, y) => {solidUpdate(x, y)}, (x, y) => {
		Element.setCell(x, y, TYPES.BONE)
		return true;
	}),

	[TYPES.CORAL]: new Element(1, (x, y) => {	
		const p = Random.octave(3, Random.perlin2D, x, y, .1);
		c = Random.choice(freqColoring([["#ff7f5004", 2], ["#f5673304", 1], ["#f5916904", 1],]));
		if (p > .5 && p < .56 && Random.bool(.85)) c = new Color(Random.bool() ? "#f0978104" : "#eb876e04");

		return c;
	}, 0.2, 0.1, (x, y) => {
		Element.affectCardinalNeighbors(x, y, (ox, oy) => {
			if (Element.isType(ox, oy, TYPES.CORAL_STIMULANT)) grid[x][y].acts = 120;
            if (Element.isType(ox, oy, TYPES.ACTIVE_NEURON) && grid[ox][oy].acts == 0) grid[x][y].acts = 60;
            if (Element.isTypes(ox, oy, CORAL_ON) && !Element.isType(ox, oy, TYPES.COMPRESSED_CORAL) && grid[ox][oy].acts > grid[x][y].acts) grid[x][y].acts = Math.min(100, grid[ox][oy].acts--);
		})
		if (grid[x][y].acts <= 0) Element.setCell(x, y, TYPES.DEAD_CORAL);
		if (grid[x][y].acts !== 0 && Element.isType(x, y, TYPES.CORAL)){
			Element.react(x, y, TYPES.DEAD_CORAL, TYPES.CORAL, 1, true);
			Element.react(x, y, TYPES.PETRIFIED_CORAL, TYPES.ELDER_CORAL, .5, true);
			Element.react(x, y, TYPES.GHOST_CORAL, TYPES.CORPOREAL_CORAL, 1, true);
		}
		grid[x][y].acts-=2;

		Element.updateCell(x, y)
	}),

	[TYPES.DEAD_CORAL]: new Element(1, (x, y) => {
		const p = Random.octave(4, Random.perlin2D, x, y, .05);
		c = Random.choice(freqColoring([["#a1948f01", 1], ["#948a8701", 2], ["#87817f01", 1]]));
		if (p > .5 && p < .52 && Random.bool(.35)) c = new Color("#afa09701");
		return c;
	}, 0.21, 0.1),

	[TYPES.ELDER_CORAL]: new Element(1, (x, y) => {	
		c = Random.choice(freqColoring([["#f5673302", 1], ["#fa7e4d02", 1], ["#f5916902", 1],]));
		return Color.lerp(c, new Color("#00000001"), .5);
	}, 0.4, 0.04, (x, y) => {
		Element.affectCardinalNeighbors(x, y, (ox, oy) => {
			if (Element.isType(ox, oy, TYPES.CORAL_STIMULANT)) grid[x][y].acts = 400;
			if (Element.isTypes(ox, oy, CORAL_ON) && !Element.isType(ox, oy, TYPES.COMPRESSED_CORAL) && grid[ox][oy].acts > grid[x][y].acts) grid[x][y].acts = grid[ox][oy].acts--;
		})
		if (grid[x][y].acts <= 0) Element.setCell(x, y, TYPES.PETRIFIED_CORAL);
		if (grid[x][y].acts !== 0 && Element.isType(x, y, TYPES.ELDER_CORAL)){
			Element.react(x, y, TYPES.DEAD_CORAL, TYPES.CORAL, .5, true);
			Element.react(x, y, TYPES.PETRIFIED_CORAL, TYPES.ELDER_CORAL, 1, true);
			Element.react(x, y, TYPES.GHOST_CORAL, TYPES.CORPOREAL_CORAL, .5, true);
		}
		grid[x][y].acts-=2;

		Element.updateCell(x, y)
	}),

	[TYPES.PETRIFIED_CORAL]: new Element(1, (x, y) => {
		const p = Random.octave(4, Random.perlin2D, x, y, .05);
		c = Random.choice(freqColoring([["#a1948f01", 1], ["#948a8701", 2], ["#87817f01", 1]]));
		if (p > .5 && p < .52 && Random.bool(.35)) c = new Color("#afa09701");
		return Color.lerp(c, new Color("#00000001"), .6);
	}, 0.45, 0.01),

	[TYPES.CORPOREAL_CORAL]: new Element(1, (x, y) => {	
		c = Random.choice(freqColoring([["#f5673302", 1], ["#fa7e4d02", 1], ["#f5916902", 1],]));
		return Color.lerp(c, new Color("#00000001"), .5);
	}, 0.4, 0.04, (x, y) => {
		Element.affectCardinalNeighbors(x, y, (ox, oy) => {
			// if (Element.isType(ox, oy, TYPES.CORAL_STIMULANT)) grid[x][y].acts = 400;
			if (Element.isTypes(ox, oy, CORAL_ON) && !Element.isType(ox, oy, TYPES.COMPRESSED_CORAL) && grid[ox][oy].acts > grid[x][y].acts) grid[x][y].acts = Math.min(100, grid[ox][oy].acts--);
		})
		if (grid[x][y].acts <= 0) Element.setCell(x, y, TYPES.GHOST_CORAL);
		if (grid[x][y].acts !== 0 && Element.isType(x, y, TYPES.CORPOREAL_CORAL)){
			Element.react(x, y, TYPES.DEAD_CORAL, TYPES.CORAL, .5, true);
			Element.react(x, y, TYPES.PETRIFIED_CORAL, TYPES.ELDER_CORAL, .5, true);
			Element.react(x, y, TYPES.GHOST_CORAL, TYPES.CORPOREAL_CORAL, 1, true);
		}
		grid[x][y].acts-=1;

		Element.updateCell(x, y)
	}),

	[TYPES.GHOST_CORAL]: new Element(1, (x, y) => {
		const p = Random.octave(4, Random.perlin2D, x, y, .05);
		c = Random.choice(freqColoring([["#a1948f01", 1], ["#948a8701", 2], ["#87817f01", 1]]));
		if (p > .5 && p < .52 && Random.bool(.35)) c = new Color("#afa09701");
		return Color.lerp(c, new Color("#00000001"), .6);
	}, 0.2, 0, (x, y) => {
		let violence = 5

		try {
		let ox = x;
		let d = 1;

		while (Element.isType(ox, y + d, TYPES.GHOST_CORAL)) {
			d++;
		}

		if (Element.inBounds(ox, y + d) && Element.isEmpty(ox, y + d) && Element.isTypes(x, y - 1, GHOST_CORAL_REACT)) {
			Element.setCell(ox, y + d, grid[x][y-1].id);
			if (Element.isTypes(x, y - 1, GHOST_CORAL_REACT)) Element.die(x, y - 1);
			else Element.updateCell(x, y);
		}
		} catch (e) { alert(e + "\n" + e.stack) }
	}),
	
	[TYPES.COMPRESSED_CORAL]: new Element(1, (x, y) => {	
		const p = Random.octave(3, Random.perlin2D, x, y, .1);
		c = Random.choice(freqColoring([["#64ede802", 2], ["#4eedd502", 2], ["#45e6c802", 2]]));
		if (p > .5 && p < .54 && Random.bool(.95)) c = new Color("#3edeb120");

		return c;
	}, 0.12, 0.15, (x, y) => {
		Element.affectCardinalNeighbors(x, y, (ox, oy) => {
			if (Element.isType(ox, oy, TYPES.CORAL_STIMULANT)) grid[x][y].acts = 40;
			if (Element.isType(ox, oy, TYPES.COMPRESSED_CORAL) && grid[ox][oy].acts > grid[x][y].acts) grid[x][y].acts = grid[ox][oy].acts--;
		})
		if (grid[x][y].acts <= 0) Element.setCell(x, y, TYPES.DEAD_COMPRESSED_CORAL);
		if (grid[x][y].acts !== 0 && Element.isType(x, y, TYPES.COMPRESSED_CORAL)){
			Element.react(x, y, TYPES.DEAD_COMPRESSED_CORAL, TYPES.COMPRESSED_CORAL, 1, true);
			Element.react(x, y, TYPES.INACTIVE_NEURON, TYPES.ACTIVE_NEURON, 1, true);
		}
		grid[x][y].acts-=2;

		Element.updateCell(x, y)
	}),

	[TYPES.DEAD_COMPRESSED_CORAL]: new Element(1, (x, y) => {
		const p = Random.octave(4, Random.perlin2D, x, y, .05);
		c = Random.choice(freqColoring([["#a1948f01", 1], ["#948a8701", 2], ["#87817f01", 1]]));
		if (p > .5 && p < .52 && Random.bool(.35)) c = new Color("#afa09701");
		return Color.lerp(c, new Color("#ffffff01"), .6);
	}, 0.1, 0.1),

	[TYPES.CORAL_STIMULANT]: new Element(1, freqColoring([
		["#0be37e01", 2], ["#08cf7201", 1], ["#05fa8801", 2], 
	]), 0.2, 0.1, (x, y) => {
		Element.affectCardinalNeighbors(x, y, (ox, oy) => {
			if (Element.isType(ox, oy, TYPES.DEAD_CORAL)) Element.setCell(ox, oy, TYPES.CORAL)
			if (Element.isType(ox, oy, TYPES.DEAD_COMPRESSED_CORAL)) Element.setCell(ox, oy, TYPES.COMPRESSED_CORAL)
			if (Element.isType(ox, oy, TYPES.PETRIFIED_CORAL)) Element.setCell(ox, oy, TYPES.ELDER_CORAL)
			// if (Element.isType(ox, oy, TYPES.GHOST_CORAL)) Element.setCell(ox, oy, TYPES.CORPOREAL_CORAL)

		})
		solidUpdate(x, y)
	}),

	[TYPES.CORAL_PRODUCER]: new Element(1, freqColoring([
		["#f02b7301", 1], ["#ed347801", 1], ["#fc388001", 1], 
	]), 0.2, 0.1, (x, y) => {
		Element.affectCardinalNeighbors(x, y, (ox, oy) => {
			if (Element.isTypes(ox, oy, CORAL_OFF)) Element.trySetCell(x, y + 1, TYPES.CORAL_STIMULANT);
		})
	}),

	[TYPES.CORAL_CONSUMER]: new Element(1, freqColoring([
		["#b34aed01", 1], ["#a743de01", 1], ["#993dcc01", 1], 
	]), 0.2, 0.1, (x, y) => {
		Element.affectCardinalNeighbors(x, y, (ox, oy) => {
			if (Element.isTypes(ox, oy, CORAL_ON) && Element.isType(x, y - 1, TYPES.CORAL_STIMULANT)) Element.setCell(x, y - 1, TYPES.AIR);
		})
	}),

	[TYPES.FLUORESCENCE]: new Element(255, Color.ORANGE, 0.1, 0.15, (x, y) => {
		let off = true;
		Element.affectCardinalNeighbors(x, y, (ox, oy) => {
			if(Element.isTypes(ox, oy, CORAL_ON)) off = false;
		});
		if(off) Element.setCell(x, y, TYPES.DORMANT_FLUORESCENCE);
	}),

	[TYPES.DORMANT_FLUORESCENCE]: new Element(1, Color.ORANGE, 0.1, 0.15, (x, y) => {
		Element.affectCardinalNeighbors(x, y, (ox, oy) => {
			if (Element.isTypes(ox, oy, CORAL_ON)) Element.setCell(x, y, TYPES.FLUORESCENCE);
		});
	}),

	[TYPES.ASH]: new Element(1, freqColoring([
		["#7f8482", 10],
		["#787d7a", 5],
		["#8a8d8a", 7],
	]), 0.01, 0, (x, y) => {
		solidUpdate(x, y, 0, .8)
		/*if(Element.isTypes(x, y + 1, LIQUID_PASSTHROUGH)) */
		//else if(Element.isTypes(x, y + 1, SOLID_PASSTHROUGH) && Random.bool(.7)) Element.tryMove(x, y, x + (Random.bool(.5) ? -1 : 1), y);

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
		Element.consumeReactMany(x, y, INSECT, TYPES.AIR);
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
		if (x % 2 === 0 && y % 2 === 0) return Color.lerp(new Color("#51678a01"), new Color("#6d82a301"), Random.random());
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
		if (x % 2 === 0 && y % 2 === 0) return Color.lerp(new Color("#8a516401"), new Color("#a36d7d01"), Random.random());
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

	[TYPES.GROUNDING_METAL]: new Element(1, new Color("#4a4a4a"), 0.65, 0),
	[TYPES.POSITIVE_METAL]: new Element(1, Color.RED, 0.65, 0, (x, y)=>{
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (Element.isType(ox, oy, TYPES.CONDUCTIVE_FLUID) && grid[ox][oy].acts > 0 && Random.bool(0.05)) {
				Element.setCell(ox, oy, TYPES.BLUE_ELECTRICITY);
				// grid[ox][oy].reference = TYPES.CONDUCTIVE_FLUID;
			}
		})
	}),

	[TYPES.CONDUCTIVE_FLUID]: new Element(1, [new Color("#120a59"), new Color("#140960"), new Color("#093560")], 0.4, 0.05, (x, y) => {
		const topValue = 300;
		let foundGround = false;
		let maxValue = 0;
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (Element.isType(ox, oy, TYPES.GROUNDING_METAL)) {
				foundGround = true;
				maxValue = topValue;
			} else if(Element.isType(ox, oy, TYPES.CONDUCTIVE_FLUID) && !foundGround){
				maxValue = Math.max(maxValue, grid[ox][oy].acts);
			}
		});
		if (!(maxValue == 0) && !(maxValue == topValue) && grid[x][y].acts !== maxValue) {
			Element.updateCell(x, y);
		}
		// if(grid[x][y].acts !== maxValue) {	
		// 	Element.updateCell(x, y);
		// }
		grid[x][y].acts = Math.max(maxValue - 1, 0);
		liquidUpdate(x, y);
	}),

	
	[TYPES.BLUE_ELECTRICITY]: new Element(40, Color.CYAN, 0, 0, (x, y)=>{
		let relPos = Vector2.origin;
		let maxValue = 0;
		let grounded = false;
		let acts = grid[x][y].acts;
		const deathType = TYPES.CONDUCTIVE_FLUID;//grid[x][y].reference;
		const lifespan = 500;
		let hydrogenProb = 0;
		if (acts > lifespan) {
			Element.setCell(x, y, TYPES.CONDUCTIVE_FLUID);
			return;
		}
		Element.affectAllNeighbors(x, y, (ox, oy)=>{
			if (Element.isType(ox, oy, TYPES.GROUNDING_METAL)){
				Element.setCell(x, y, deathType);
				return;
			} 
			if(Element.isType(ox, oy, TYPES.CONDUCTIVE_FLUID)){
				hydrogenProb += 1;
			}
			if (grid[ox][oy].acts > maxValue) {
				maxValue = grid[ox][oy].acts
				relPos = new Vector2(ox - x, oy - y);
			}
		})
		grid[x][y].acts = acts + 1;
		// if (maxValue == 0) {
		// 	grid[x][y].acts = acts + 5;
		// 	return;
		// }
		relPos.mag = 1;
		grid[x][y].vel = relPos
		let moved = Element.tryMove(x, y, x + Math.round(relPos.x), y + Math.round(relPos.y), ELECTRICITY_PASSTHROUGH);/*, (x, y, fx, fy) => {
			const targetType = grid[fx][fy].type;
			grid[x][y].reference = targetType;
			Element.setCellId(fx, fy, TYPES.BLUE_ELECTRICITY);
		}); //TODO set passthrough up*/
	
		// if(moved){
			Element.setCell(x, y, deathType);
			if (Element.isEmpty(x, y - 1) && Random.bool((hydrogenProb/8)/10)) {
				Element.trySetCell(x, y - 1, TYPES.HYDROGEN)
			}
		// }
		Element.updateCell(x, y);
	}, true),


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

	[TYPES.GRANITE]: new Element(1, (x, y) => {
		const layer = (x, y) => {
			const angle = Math.PI / 3;
			const c = Math.cos(angle);
			const s = Math.sin(angle);
			[x, y] = [x * c - y * s, x * s + y * c];
			y /= 5;
			y += Random.perlin(x, 5) * 3;
			const p = Random.perlin2D(x, y, 0.1);
			return (p > .5) ? new Color("#40322801") : new Color("#4d271701");
		};
		//#403228
		//#302819
		//#4d2717
		return Color.avg([layer(x, y), layer(x * 5, y * 5), layer(x * 10, y * 10)]);
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
	]), 0.2, 0.1, solidUpdate, (x, y) => {
		// if (Random.bool(0.1)) Element.setCell(x, y, TYPES.CARMEL);
		return true;
	}),

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
		if (grid[x][y].acts === 4) {
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

		if (grid[x][y].acts === 2) {
			Element.setCell(x + 1, y - 1, TYPES.KELP_TOP);
			grid[x + 1][y].acts = 1;
			Element.setCell(x + 1, y - 2, TYPES.KELP_TOP);
			grid[x + 1][y].acts = 1;
		}

		if (grid[x][y].acts === 3) {
			Element.setCell(x - 1, y - 1, TYPES.KELP_TOP);
			grid[x + 1][y].acts = 1;
			Element.setCell(x - 1, y - 2, TYPES.KELP_TOP);
			grid[x + 1][y].acts = 1;
		}
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.4) ? (Random.bool(.2) ? TYPES.ASH : TYPES.SMOKE) : TYPES.STEAM);
	}),

	[TYPES.ESTIUM]: new Element(0, new Color("#96304d00"), .35, .08, (x, y) => {
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

				intervals.delay(() => {
					eventSoundEffects.thunderSound.frequency++;
				}, ~~Random.range(60, 100));
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
		const color1 = reference === TYPES.STAINED_SNOW ? Color.BLANK : Color.alpha(DATA[reference].getColor(x, y), Color.EPSILON);
		const color2 = DATA[TYPES.SNOW].getColor(x, y);
		return Color.lerp(color1, color2, 0.5);
	}, 0.5, 0.2, (x, y) => {
		if (Element.isTypes(x, y - 1, LIQUID)){
			if(Random.bool(.01)) Element.setCell(x, y, TYPES.AIR);
			else if(grid[x][y].reference === grid[x][y-1].id) Element.permeateDye(x, y, TYPES.STAINED_SNOW, TYPES.SNOW, 1);
		}
		solidUpdate(x, y, GRAVITY, 0);
	}, (x, y) => {
		Element.setCell(x, y, grid[x][y].reference);
		return true;
	}, true),

	[TYPES.COTTON]: new Element(1, (x, y) => {
		let p = Random.voronoi2D(x, y, 0.15);
		if(p < .7 && p > .3) return new Color(Random.bool() ? "#d9dbd701" : "#d0d1cf01")
		else if(p < .3) return new Color(Random.bool() ? "#edf0eb01" : "#e8e8e801");
		else return new Color(Random.bool() ? "#8a8a8a01" : "#787d7801")
	}, 0.05, .4, (x, y) => {
		let reacted = false;
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (!reacted && Element.isTypes(ox, oy, LIQUID) && Random.bool(0.1)) {
				Element.setCell(x, y, TYPES.DYED_COTTON);
				grid[x][y].reference = grid[ox][oy].id;
				Element.die(ox, oy);
				reacted = true;
			}
		});
	}, (x, y) => {
		Element.trySetCell(x, y-1, Random.bool() ? TYPES.SMOKE : TYPES.ASH);
	}),

	[TYPES.DYED_COTTON]: new Element(1, (x, y) => {
		const { reference } = grid[x][y];
		const color1 = reference === TYPES.DYED_COTTON ? Color.BLANK : Color.alpha(DATA[reference].getColor(x, y), Color.EPSILON);
		const color2 = DATA[TYPES.COTTON].getColor(x, y);
		return Color.lerp(color1, color2, 0.2);
	}, 0.07, .1, (x, y) => {
		if (Element.isTypes(x, y - 1, LIQUID) && (grid[x][y].reference === grid[x][y-1].id))
			Element.permeateDye(x, y, TYPES.DYED_COTTON, TYPES.COTTON, 0);
	}, (x, y) => {
		Element.trySetCell(x, y-1, Random.bool() ? grid[x][y].reference : TYPES.ASH);
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
			liquidUpdate(x, y, soundEffects.lavaSound);

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
			liquidUpdate(x, y, soundEffects.lavaSound);
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
			liquidUpdate(x, y, soundEffects.lavaSound);
		lavaUpdate(x, y, TYPES.FIRE);
	}),

	[TYPES.MAGNESIUM]: new Element(200, (x, y) => {


		y *= 1.1;
		x *= 1.1;
		y += Random.sampleSeed;
		let yt = y % 2;

		if (yt < 0) yt++;
		// yt = Interpolation.smooth(yt);
		y = ~~y;
		x = ~~x;

		const top = Random.seedRand(x + y * 2000);
		const bottom = Random.seedRand(x + (y + 1) * 2000);

		return Color.alpha(Color.lerp(new Color("#787878"), new Color("#99a7a8"), top * (1 - yt) + bottom * yt), 0.01);
		//return new Color("#ffff0001");
	}, 0.5, 1, (x, y) => {
		solidUpdate(x, y, GRAVITY, 0);
		let waterCount = Element.getNeighborsOfTypes(x, y, WATER_TYPES).reduce((a, b) => a + b);
		if (waterCount) {
			Element.updateCell(x, y);
		}
		if (waterCount > 2 && Random.bool(0.000001)) {
			Element.tryBurn(x, y, TYPES.MAGNESIUM_FIRE);
			Element.tryBurn(x, y + 1, TYPES.MAGNESIUM_FIRE);
			Element.tryBurn(x, y + 2, TYPES.MAGNESIUM_FIRE);


		}
	}, (x, y) => {
		makeCircle(x, y, TYPES.MAGNESIUM_FIRE, 3);
		Element.die(x, y);
		return true;
	}),

	[TYPES.MAGNESIUM_FIRE]: new Element(200, (x, y) => {
		return Color.alpha(Color.WHITE, 200);
	}, 0, 0, (x, y) => {
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (Element.isTypes(ox, oy, WATER_TYPES)){
				Element.setCell(ox, oy, TYPES.MAGNESIUM_FIRE);
				makeCircle(x, y, TYPES.HYDROGEN, 10, 1, WATER_TYPES);
				if (Random.bool(0.5)) {
					explode(ox, oy, 5, 0.25, WATER_TYPES);
				}
			}
		});
		fireUpdate(x, y, TYPES.MAGNESIUM_FIRE, true, true);
	}, false),

	[TYPES.UNSTABLE_ELEMENT]: new Element(0, (x, y) => {
		return Color.alpha(new Color(Random.range(0,255), 0, 0), 0);
	}, 0, 1, (x, y) => {
		let thisCell = grid[x][y];
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			console.log("being run");
			let cell = grid[ox][oy]
			if (!Element.isEmpty(ox, oy)){
				let isCondensed = (Element.isType(ox, oy, TYPES.CONDENSED_STONE));
				let velocity = cell.vel.mag;
				let coral = (Element.isTypes(ox, oy, CORAL_ON));
				let rando = (Random.bool(0.4));
				let isUnstable = ((rando) ? Element.isType(ox, oy, TYPES.UNSTABLE_ELEMENT) : 0);

				// console.log("isCondensed: " + isCondensed + "\nvelocity: " + velocity + "\ncoral: " + coral + "\nrando: " + rando + "\nisUnstable: " + isUnstable);

				let count = isUnstable + isCondensed + Math.round(velocity*2) + coral;
				console.log(count);
				// count += (count < 2)? (rando) ? count * 2 : 1 : 0;
				cell.acts += count;
			}
		});
		if (thisCell.acts >= Random.range(50, 100)){
			Element.setCell(x, y, TYPES.EXPLOSIVE_DUST);
			
		}
		
	}, (x, y) => {
		grid[x][y].acts += 5;
		Element.updateCell(x, y);
		return true;
	}
	),

	[TYPES.SEMI_STABLE_ELEMENT]: new Element(0, (x, y) => {
		return Color.alpha(new Color(Random.range(0, 225), 0, Random.range(0, 255)), 0);
	}, 0, 1, (x, y) => {
		let thisCell = grid[x][y];
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			console.log("being run");
			let cell = grid[ox][oy]
			if (!Element.isEmpty(x, y) && (Random.bool(0.005) || cell.vel.mag > 1 || Element.isTypes(ox, oy, CORAL_ON))){
				thisCell.acts++;
				thisCell.acts += cell.vel.mag;
				console.log("has been detected");
			}
		});
		if (thisCell.acts >= Random.range(50, 150)){
			Element.setCell(x, y, TYPES.CONDENSED_STONE);
			
		}
		
	}, (x, y) => {
		grid[x][y].acts += 5;
		Element.updateCell(x, y);
		return true;
	}
	),

	//teleport using script similair to permeate script, distance checker?

	[TYPES.MEDUSAS_GEM]: new Element(1, [new Color("#7e8d94"), new Color("#838f91")], 0.5, 0, (x, y) => {
		const thisCell = grid[x][y];

		Element.affectAllNeighbors(x, y, (X, Y) => {
			const cell = grid[X][Y];

			let reference = TYPES.AIR;
			if (Element.isTypes(X, Y, NEURON)) {
				reference = TYPES.MARBLE;
			}else if (Element.isType(X, Y, TYPES.EPIDERMIS)){
				reference = TYPES.BRICK;
			}else if (Element.isType(X, Y, TYPES.CEREBRUM)){
				reference = TYPES.CLAY;
			}else if (Element.isType(X, Y, TYPES.MUSCLE)){
				reference = TYPES.STONE;
			}else if (Element.isType(X, Y, TYPES.BONE)){
				reference = TYPES.CONDENSED_STONE;
			}
			if(reference != TYPES.AIR){
				Element.setCell(X, Y, TYPES.MEDUSAS_GEM);
				grid[X][Y].reference = reference;
			}
		});
		thisCell.acts++;
		if (thisCell.acts > 5) {
			Element.dereference(x, y);
		}
		Element.updateCell(x, y);
	}, (x, y) => null, true),

	
	[TYPES.CARO_GEM]: new Element(1, [new Color("#b55758"), new Color("#784445")], 0.5, 0, (x, y) => {
		const thisCell = grid[x][y];

		Element.affectAllNeighbors(x, y, (X, Y) => {
			const cell = grid[X][Y];
			let reference = TYPES.AIR;
			if (Element.isType(X, Y, TYPES.MARBLE)) {
				reference = TYPES.INACTIVE_NEURON;
			}else if (Element.isType(X, Y, TYPES.CLAY)){
				reference = TYPES.CEREBRUM;
			}else if (Element.isType(X, Y, TYPES.BRICK)){
				reference = TYPES.EPIDERMIS;
			}else if (Element.isType(X, Y, TYPES.STONE)){
				reference = TYPES.MUSCLE;
			}else if (Element.isType(X, Y, TYPES.CONDENSED_STONE)){
				reference = TYPES.BONE;
			}
			if(reference != TYPES.AIR){
				Element.setCell(X, Y, TYPES.CARO_GEM);
				grid[X][Y].reference = reference;
			}
		});
		thisCell.acts++;
		if (thisCell.acts > 5) {
			Element.dereference(x, y);
		}
		Element.updateCell(x, y);
	}, (x, y) => null, true),

	[TYPES.RADIUM_GEM]: new Element(1, [new Color("#b55758"), new Color("#784445")], 0.5, 0, (x, y) => {
		const thisCell = grid[x][y];

		Element.affectAllNeighbors(x, y, (X, Y) => {
			const cell = grid[X][Y];
			let reference = cell.id;
			if(!Element.isTypes(X, Y, RADIATION_RESISTANT) && thisCell.acts < 1){
				Element.setCell(X, Y, TYPES.RADIUM_GEM);
				let change = Random.bool() ? -1 : 1;
				while (RADIUM_SKIP.has((reference+change) % ELEMENT_COUNT)) {
					change += change;
				}
				if (!RADIUM_SKIP.has((reference+change) % ELEMENT_COUNT)) {
					grid[X][Y].reference = (reference+change) % ELEMENT_COUNT;
				} else{
					grid[X][Y].reference = reference;
				}
			}
		});

		thisCell.acts++;

		if (thisCell.acts > 5) {
			Element.dereference(x, y);
		}
		Element.updateCell(x, y);
	}, (x, y) => null, true),

	[TYPES.ANTMARKER]: new Element(0.1, (x, y) => {
		return new Color("#838f91");
	}, 0, 0, (x, y) => {
		//if acts are empty then fill with hgih value
		let cell = grid[x][y];
		let toHome = readBitfield(cell.acts, 0, 16);
		let toFood = readBitfield(cell.acts, 16, 16);
		//the structure: tohome first, then to food
		toHome -= 1;
		toFood -= 1;
		toHome |= 0xffff;
		toFood |= 0xffff;
		toFood <<= 16;
		cell.acts = toHome | toFood;

	}, (x, y) => {
		return false;
	}, true),

	// [TYPES.ANTSIM]: new Element(0, (x, y) => {
	// 	return Color.alpha(new Color("brown"), 0);
	// }, 1, 0.5, (x, y) => {
	// 	//okay simple testing
	// 	//all there is will be a two pheromone system
	// 	//sudo code time
	// 	//get grid reference to the cells the ant can see
	// 	//check if food
	// 	//get pheromone values for each
	// 	//compare them all
	// 	//move to most recent one
	// 	//place new marker
	// 	//

	// 	let getActsArray = (acts) => {
	// 		let toHome = readBitfield(acts, 0, 16);
	// 		let toFood = readBitfield(acts, 16, 16);
	// 		return [toHome, toFood];
	// 	}
	// 	let placeActsArray = (toHome, toFood) => {
	// 		toHome |= 0xffff;
	// 		toFood |= 0xffff;
	// 		toFood <<= 16;
	// 		return(toHome | toFood);
	// 	}
	// 	let cell = grid[x][y];
	// }),

    [TYPES.FIREANT]: new Element(0, (x,y) => {
		return Color.alpha(new Color("rosybrown"), 0);
    }, 1, 0.5, (x, y) => {
        //retrieve data
        //[holding food, current pheromone Frame, simFrame]
        
        //pheromone age measured in frame

        //determine direction to travel
    }),

	[TYPES.TERMITE]: new Element(0, (x, y) => {
		return Color.alpha(new Color("brown"), 0);
	}, 1, 0.5, (x, y) => {
		let AntEatenData = [false, 0, 0];
		Element.affectNeighbors(x, y, (ox, oy) => {
			if (Element.isTypes(ox, oy, TERMITE_EATABLE) && grid[x][y].acts == 0) {

				if (Element.isTypes(ox, oy, TERMITE_FOOD) || Random.bool(0.05)) {
					grid[x][y].acts = 1;
					grid[x][y].vel.rotate(Math.PI)
				}else{
					grid[x][y].vel.rotate(Random.int(-1,1) * (Math.PI / 16))
				}
				Element.setCell(ox,  oy, TYPES.AIR);
				AntEatenData = [true, ox, oy];
			} 
			if (Element.isType(ox, oy, TYPES.ANT_HILL) && grid[x][y].acts == 1){
				// if (grid.acts == 1) {
				grid[ox][oy].acts = 1;
				points++;
				console.log("food arrived! points: " + points);
				// if (Random.bool(0.9)) {
				// 	let pos = [x-Math.round(grid[x][y].vel.x), y-Math.round(grid[x][y].vel.y)]
					// Element.setCell(x-Math.round(grid[x][y].vel.x), y-Math.round(grid[x][y].vel.y), TYPES.TERMITE);
				// 	grid[pos[0]][pos[1]].vel = grid[x][y].vel;
				// 	grid[pos[0]][pos[1]].vel.rotate(Math.pi)
				// }
				// if (Random.bool(0.5)) Element.setCell(x, y, TYPES.ANT_HILL) //ant hill grower
				
				grid[x][y].acts = 0;
				grid[x][y].vel.rotate(Math.PI)
				// return;
			}
		});
		
		let cell = grid[x][y];
		let vel = cell.vel;
		// if (cell.acts > 1) {
		// 	cell.acts = 0;
		// }
		//startup checker
		if(cell.vel.mag == 0) cell.vel = new Vector2(Random.int(-1,1), Random.int(-1,1));
		// cell.vel.mag = 1;

		// const relGridGet = (x, y, vector) => {
		// 	if (Element.isEmpty(x + Math.round(vector.x), y + Math.round(vector.y)))
		// 	return grid[x + Math.round(vector.x)][y + Math.round(vector.y)];
		// 	else return grid[x][y];
		// };

		// const antCheck = (angle, isWandering = true) =>{
		// 	let delta = vel.rotate(angle);
		// 	let checkedCell = relGridGet(x, y, delta)
		// 	if (checkedCell.id != TYPES.AIR) return 0;
		// 	let strength = 0;
		// 	let pheromones = antBytePaser(checkedCell.acts);

		// 	strength += (!isWandering) ? antPheromoneValue(pheromones[0]) : 0;
		// 	strength += (isWandering) ? antPheromoneValue(pheromones[1]) * 5: 1; 
		// 	return(strength);
		// };
		//cell checker for pheromones

		wandering = grid[x][y].acts == 0; //if not wandering then it is returning

		let strengthL = antCheck(x, y, -Math.PI/4, vel, wandering);
		let strengthF = antCheck(x, y, 0, vel, wandering);
		let strengthR = antCheck(x, y, Math.PI/4, vel, wandering);

		// const variableRando = 0.001;
		const baseRando = 0.001; //when wandering
		const angle = 25 * Math.PI / 180;

		if (strengthF > strengthL && strengthF > strengthR) {
			// console.log("rotate forward");
			vel.rotate(0);
		} else if (strengthR > strengthL){
			// console.log("rotate right");
			vel.rotate(angle);
		} else if  (strengthR < strengthL) {
			// console.log("rotate left");
			vel.rotate(-(angle));
		} else {//if (strengthF == strengthR && strengthF == strengthL && strengthF == 0) {
			vel.rotate( (Random.bool(baseRando) && wandering) ? (Random.int(-1,1)) * (angle) : 0);
		}

		let checkedCell = relGridGet(x, y, vel)
		let pheromones = antBytePaser(checkedCell.acts);
		
		let outAct;
		if (wandering) {
			// outAct = antBytePlacer(true, false, pheromones[0], pheromones[1])
			outAct = antBytePlacerNew(true, false, pheromones[0], pheromones[1])
		}else {
			// outAct = antBytePlacer(false, true, pheromones[0], pheromones[1])
			outAct = antBytePlacerNew(false, true, pheromones[0], pheromones[1])
		}
		if (AntEatenData[0]){
			grid[AntEatenData[1]][AntEatenData[2]].acts = antBytePlacer(false, true);
		}
		// console.log("acts: " + outAct + "\tW? " + wandering);

		let moved = Element.tryMove(x, y, x + Math.round(vel.x), y + Math.round(vel.y), SOLID_PASSTHROUGH, (x, y, fx, fy) => {
			const t = grid[fx][fy];
			grid[fx][fy] = grid[x][y];
			if (vel.mag != 0 && t.id === TYPES.AIR) t.acts = outAct;
			grid[x][y] = t;
			Element.updateCell(x, y);
			Element.updateCell(fx, fy);
		});
		
		//TODO make the ants see perpendicular to where they are normally able to, or implement a way to have several relative things, a view cone

		if (!moved) vel.rotate((Random.int(-1,1)) * angle);//(Math.PI/4)); //Math.PI/2)); //try reflecting the vel like an actual mirror, to make it mroe accurate
		
		// outAct = 0b1111;
		// console.log(outAct + ": " + outAct.toString(2));
		
		if (moved && vel.mag != 0) {
			grid[x][y].acts = outAct;
		}

		// if (moved && vel.mag != 0 && Random.bool(0.25)) {
		// grid[x][y].acts = outAct;
		// 	console.log(outAct);
		// 	r = 2;
		// 	for (let i = -r; i <= r; i++) {
		// 		for (let j = -r; j <= r; j++) {
		// 			if (i * i + j * j < r * r) {
		// 				let ox = i + x - Math.round(vel.x);
		// 				let oy = j + y - Math.round(vel.y);
		// 				if (Element.inBounds(ox, oy) && !Element.isType(ox, oy, TYPES.TERMITE))
		// 					if(Element.isType(ox, oy, TYPES.AIR)) grid[ox][oy].acts = outAct;
		// 			}
		// 		}
		// 	}
		// }
		Element.updateCell(x, y);
	}),


	[TYPES.ANT_TESTER]: new Element(1, [new Color("red")], 1, 0.5, (x, y) => {
		let cell = grid[x][y];
		let vel = cell.vel;
		if(cell.vel.mag == 0) cell.vel = new Vector2(Random.int(-1,1), Random.int(-1,1));
		vel.mag = 1;
		if (Random.bool(0.005)) vel.rotate((Random.bool(0.5) ? 1 : -1) * Math.PI/4);

		// //need to create a byte reader and tester
		// //so acts is a 32 bit integer
		// //use programming calc to do this
		// let kernelS = 0b11111111000000000000000000000000;
		// vel.x = 1;
		// //need to implement a in bounds check here
		// if (Element.inBounds(x+vel.x, y)) {
		// 	vel.y = (grid[x+vel.x][y].acts > 5) ? 10 : 0;
		// }
		vel.x = Math.round(vel.x);
		vel.y = Math.round(vel.y);
		Element.tryMove(x, y, x + vel.x, y + vel.y, LIQUID_PASSTHROUGH);
		// console.log(simFrameCount.toString(2).length/8 + ":" + simFrameCount.toString(2) + "\t:" + simFrameCount);
		
		

		Element.updateCell(x, y);
		// grid[x][y].acts = 196,611;
		grid[x][y].acts = 2,147,581,953
		
	}),

	[TYPES.ANGLE_TESTER]: new Element(1, [new Color("red")], 1, 0.5, (x, y) => {
		let vel = grid[x][y].vel;
		while (vel.mag == 0) {
			vel = new Vector2(Random.int(-1,1), Random.int(-1,1)); 
		}
		vel.mag = 1;
		let delta = vel.rotated();
		vel1 = vel.rotated(0);
		Element.setCell(x + Math.round(vel1.x), y + Math.round(vel1.y), TYPES.GLASS);

		vel2 = vel.rotated(Math.PI/4);
		Element.setCell(x + Math.round(vel2.x), y + Math.round(vel2.y), TYPES.GLASS);

		vel3 = vel.rotate(-Math.PI/4);
		Element.setCell(x + Math.round(vel3.x), y + Math.round(vel3.y), TYPES.GLASS);

		Element.setCell(x, y, TYPES.AIR);
	}),

	[TYPES.ANT_ACT_TESTER]: new Element(1, [new Color("red")], 1, 0.5, (x, y) => {
		Element.setCell(x, y, TYPES.AIR);
		grid[x][y].acts = antBytePlacer(true, true);
		
	}),

	[TYPES.CARMEL]: new Element(0, [new Color("#993e11"), new Color("#8c480d")], 0.3, 0, (x, y) => {
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (Element.isEmpty(ox, oy, LIQUID_PASSTHROUGH) && !Element.isType(ox, oy, TYPES.TERMITE)) {
				// grid[ox][oy].acts = antBytePlacerNew(false, true);
			}
		})
	}, (x, y) => {
		// Element.setCell(x, y, TYPES.STEAM);
		return true;
	}),

	[TYPES.ANT_HILL]: new Element(0, (x, y) => {
		let colors = [new Color("brown"), new Color("red")]
		const modify = (color) => {
			color.brightness = (color.brightness) * (0.5)
			return Color.alpha(color, 0);
		}

		
		
		return (Random.bool(.5) ? modify(new Color("brown")) : modify(new Color("red"))  );
	}, 0.3, 0.01, (x, y) => {
		
		Element.affectAllNeighbors(x, y, (ox, oy) => {
			if (Element.isEmpty(ox, oy, LIQUID_PASSTHROUGH) && !Element.isType(ox, oy, TYPES.TERMITE)) {
				if (Random.bool(0.01) | (grid[x][y].acts == 1 & Random.bool(0.05))){ //normal chance = 0.001
					makeCircle(x, y, TYPES.TERMITE, 2, 0.01, WATER_PASSTHROUGH);
					grid[x][y].acts = 0;
				}
				else{
					// grid[ox][oy].acts = antBytePlacerNew(true, false);
					Element.updateCell(ox, oy);
				}
			}
		})
		Element.updateCell(x, y);
	}, (x, y) => {
		if (Random.bool(0.1)) explode(x, y, 3, 0.25);
	}),

	[TYPES.SCREEN_WIPE]: new Element(1, new Color(255, 0, 255), 0, 0, (x, y) => {

		const num = 3;
		
		const maxItratIterations = Random.int(10,15) * num;
		let cell = grid[x][y];
		let acts = cell.acts;
		if (acts == 0) {
			cell.vel = new Vector2(Random.random()*2 - 1, Random.random()*2 - 1);
		}
		let radius = Math.round(num / (acts + 1));
		cell.vel.mag = Math.max(radius * (num - 1), 1);
		
		const placeNext = (inVel) => {
			let nextPosition = new Vector2(x + Math.round(inVel.x), y + Math.round(inVel.y));
			if (Element.inBounds(nextPosition.x, nextPosition.y)) {
				makeLine(x, y, nextPosition.x, nextPosition.y, TYPES.AIR, radius, 1, new Set([TYPES.SCREEN_WIPE]));
				Element.setCell(nextPosition.x, nextPosition.y, TYPES.SCREEN_WIPE);
				grid[nextPosition.x][nextPosition.y].acts = acts + 1;
				grid[nextPosition.x][nextPosition.y].vel = inVel;
				Element.updateCell(nextPosition.x, nextPosition.y);
			}
		}

		const angle = (Math.PI / 4) / (acts + 1);

		if (acts < maxItratIterations) {
			const velocity = new Vector2(cell.vel.x, cell.vel.y);
			placeNext(velocity.rotated(angle));
			placeNext(velocity.rotated(-angle));
		}
		Element.setCell(x, y, TYPES.AIR);

	}),

	[TYPES.TREE_SEED]: new Element(1, freqColoring([
		["#423322", 9],
		["#291f14", 8],
		["#362a1d", 4],
		["#69543e", 4],
		["#594936", 3],
	]), 0.04, 0.06, (x, y) => {
		solidUpdate(x, y);

		if (Element.isType(x, y + 1, TYPES.DAMP_SOIL) && grid[x][y + 1].acts === 0) {
			Element.setCell(x, y, TYPES.TREE_GENERATOR);
		}
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.4) ? TYPES.ASH : TYPES.SMOKE);
	}),

	[TYPES.TREE_GENERATOR]: new Element(1, (x, y) => {
		return DATA[TYPES.WOOD].getColor(x, y)
	}, 0.5, 0.2, (x, y) => {

		let cell = grid[x][y];
		let acts = cell.acts;
		if (Random.bool(0.01 * (acts+1))) {
			const maxIterations = 7;
			if (acts == 0) {
				cell.vel = new Vector2(0, -1);
			}


			let radius =  (acts == 0) ? 3 : Math.round(5 / (acts + 1));
			cell.vel.mag = (acts == 0) ? 7 : Math.max(radius * 5, 1) + 3;
			
			if (acts == 0) {
				makeCircle(x, y, TYPES.ROOT, radius, 1, new Set([TYPES.DAMP_SOIL]));
			}

			const placeNext = (inVel) => {
				let nextPosition = new Vector2(x + Math.round(inVel.x), y + Math.round(inVel.y));
				if (Element.inBounds(nextPosition.x, nextPosition.y)) {
					makeLine(x, y, nextPosition.x, nextPosition.y, TYPES.WOOD, radius, 1, TREE_PLACING_PASSTHROUGH);
					Element.setCell(nextPosition.x, nextPosition.y, TYPES.TREE_GENERATOR);
					grid[nextPosition.x][nextPosition.y].acts = acts + 1;
					grid[nextPosition.x][nextPosition.y].vel = inVel;
					Element.updateCell(nextPosition.x, nextPosition.y);
				}
			}
			const angle = (acts == 0) ? 0 : (20  + Random.int(-5, 5)) * (Math.PI/180)//(Math.PI / 3) / (acts + 3);
	
			if (acts < maxIterations) {
				const velocity = new Vector2(cell.vel.x, cell.vel.y);
				placeNext(velocity.rotated(angle));
				placeNext(velocity.rotated(-angle));
			} 
			if (Math.abs(maxIterations - acts) < 3) {
				const velocity = new Vector2(cell.vel.x, cell.vel.y);
				let velArr = [velocity.rotated(-angle), velocity.rotated(angle)];
				velArr.forEach(inVel => {
					inVel.mag = radius;
					let nextPosition = new Vector2(x + Math.round(inVel.x), y + Math.round(inVel.y));
					
					if (Element.isEmpty(nextPosition.x, nextPosition.y, TREE_PLACING_PASSTHROUGH)) {
						Element.setCell(nextPosition.x, nextPosition.y, TYPES.LEAVES);
					}
				});
			}
			Element.setCell(x, y, TYPES.WOOD);
			
		} else {
			Element.updateCell(x, y);
			
		}
	}),

	// [TYPES.CACTUS_TRUNK]: new Element(),

	[TYPES.LEAVES]: new Element(0, [new Color("#025c0e"), new Color("#2d7036"), new Color("#219130")], 0.01, 0.25, (x, y) => {
		const cell = grid[x][y];
		let acts = cell.acts;
		const maxGrowth = 4;
		if (acts < maxGrowth){
			let arr = (Element.getNeighborsOfType(x, y, TYPES.WOOD));
			let woodCount = arr.reduce((a, b) => a + b);
			if (woodCount < 3 && woodCount != 0) {
				Element.affectAllNeighbors(x, y, (ox, oy) => {
					if(Element.isEmpty(ox, oy)){
						Element.trySetCell(ox, oy, TYPES.LEAVES, TREE_PLACING_PASSTHROUGH);
						grid[ox][oy].acts = acts + 0;
					}
				})
			}
			Element.affectAllNeighbors(x, y, (ox, oy)=>{
				if(Element.isEmpty(ox, oy)){
					Element.setCell(ox, oy, TYPES.LEAVES);
					grid[ox][oy].acts = acts + 1;
				}
			});
			cell.acts++;
		}
		
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
			liquidUpdate(x, y, soundEffects.lavaSound);
		lavaUpdate(x, y, TYPES.FIRE);
	}),

	[TYPES.RUST]: new Element(1, [new Color("#782907"), new Color("#802a05")], .3, 0, solidUpdate),

	[TYPES.MERCURY]: new Element(2, new Color("#949BA1"), .65, 0, (x, y) => {
		Element.consumeReact(x, y, TYPES.STONE, Random.bool(.9) ? TYPES.SAND : TYPES.AUREATE_DUST, .05);

		liquidUpdate(x, y)
	}),

	[TYPES.WATER_VAPOR]: new Element(0, (x, y) => {
		let blue = new Color("blue");
		let background = DATA[TYPES.TILE_BASE]
						.getColor(x, y)
						.times(0.1)
						.opaque;
		return Color.alpha(Color.lerp(background, blue, 0.2), 0);
	}, 0.1, 0, (x, y) => {
		//altitude init
		//recalc alt with random chance
		//condensate with random chance
		//reference == water type ?
		//hover / gitter
		//glass / ice / metal interaction
		//okay better way interact with self 
		let cell = grid[x][y];
	

		if (Random.bool(0.0001)) {
			Element.setCell(x, y, TYPES.WATER);
			return;
		}
		if (cell.vel.mag === 0) {
			cell.vel = new Vector2(0, 1);
			cell.vel.mag = 1;
		}
		//version of chaos update but rn distrubution testing
		let waterVaporCount = Element.getNeighborsOfTypes(x, y, WATER_TYPES).reduce((a, b) => a+b);
		let solidCount = Element.getNeighborsOfTypes(x, y, SOLID).reduce((a, b) => a + b);
		if (waterVaporCount > 3 || solidCount > 1) {
			cell.vel.y -= 5;
			if (waterVaporCount > 7) {
				cell.vel.y -= 10
			}
		} else {
			cell.vel.y += 1;
		}

		if (Random.bool(0.5)) cell.vel.x = Number.clamp(cell.vel.x + 3 - (Random.bool() * 6), -3, 3);
		
		cell.vel.mag = 2;
		Element.tryMove(x, y, x + Math.round(cell.vel.x), y + Math.round(cell.vel.y), SOLID_PASSTHROUGH);
	}, (x, y) => null),

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
				synthSoundEffects.bahhumSound.frequency++;
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
		if (grid[x][y].acts !== 1) {
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

		if (Element.isEmpty(x, y + 1)) Element.die(x, y);
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

		if (Element.isType(x, y + 1, TYPES.DAMP_SOIL) && grid[x][y + 1].acts === 0) {
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

		if (grid[x][y].acts > 1 && (Element.isType(x, y - 1, TYPES.AIR) || Element.isType(x, y - 1, TYPES.THICKET) || (Element.isType(x, y - 1, TYPES.THICKET_STEM) && grid[x][y-1].acts === -1))) {
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

		if(grid[x][y].acts === 1){
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
		if(grid[x][y].acts === 0) Element.consumeReact(x, y, TYPES.AIR, TYPES.INCENSE, .01);
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
		if (Element.isType(x, y + 1, TYPES.DAMP_SOIL) && grid[x][y + 1].acts === 0) {
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
		if (grid[x][y].acts === 1) {
			let thisPassthrough = new Set([...SOLID_PASSTHROUGH]);
			thisPassthrough.add(TYPES.SUNFLOWER_SEED);
			thisPassthrough.add(TYPES.SUNFLOWER_STEM);
			thisPassthrough.add(TYPES.SUNFLOWER_PETAL);

			let shift = Random.range(0, Math.PI / 9)
			for (let i = shift; i < 2 * Math.PI + shift; i += Math.PI / 9) {
				const c = Math.cos(i);
				const s = Math.sin(i);
				makeLine(Math.round(c * 6 + x), Math.round(s * 6 + y), Math.round(c * 7 + x), Math.round(s * 7 + y), TYPES.SUNFLOWER_PETAL, 1, 1, thisPassthrough);
			}
			makeCircle(x, y, TYPES.SUNFLOWER_PETAL, 6, 1, thisPassthrough)
			makeCircle(x, y, TYPES.SUNFLOWER_SEED, 5, 1, thisPassthrough)

			grid[x][y].acts--;
		}
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.6) ? (Random.bool(.2) ? TYPES.ASH : TYPES.SMOKE) : TYPES.STEAM);
	}),

	[TYPES.CONWAY_ALIVE]: new Element(1, new Color(255, 255, 255, 1), 0.99, 0, (x, y) => {
		const cell = grid[x][y];
		if (simFrameCount % 2 === 0) {
			const arr = Element.getNeighborsOfType(x, y, TYPES.CONWAY_ALIVE);
			cell.acts = arr.reduce((a, b) => a + b);
		}else {
			const survivalRules = [false, false, true, true, false, false, false, false];
			let acts = cell.acts;
			Element.setCell(x, y, survivalRules[acts] ? TYPES.CONWAY_ALIVE : TYPES.CONWAY_DEAD);
			cell.acts = acts;
		}
		Element.updateCell(x, y);
	}, (x, y) => null, true),
	
	[TYPES.CONWAY_DEAD]: new Element(1, new Color(0, 0, 0, 1), 0, 1, (x, y) => {
		const cell = grid[x][y];
		if (simFrameCount % 2 === 0) {
			const arr = Element.getNeighborsOfType(x, y, TYPES.CONWAY_ALIVE);
			cell.acts = arr.reduce((a, b) => a + b);
		}else {
			const survivalRules = [false, false, false, true, false, false, false, false];
			let acts = cell.acts;
			Element.setCell(x, y, survivalRules[cell.acts] ? TYPES.CONWAY_ALIVE : TYPES.CONWAY_DEAD);
			cell.acts = acts;
		}
		if ((Random.bool(Math.max(Random.perlin2D(x, y, .3), 0.005)))) {
			if (Element.react(x, y, TYPES.AIR, TYPES.CONWAY_DEAD)) {
				synthSoundEffects.bahhumSound.frequency++;
				Element.updateCell(x, y);
			}
		} 
	}, (x, y) => {
		Element.setCell(x, y, TYPES.CONWAY_ALIVE);
		return true;
	}, true),

	[TYPES.DAMP_SOIL]: new Element(1, freqColoring([
		["#34292c", 35],
		["#4f3f32", 35],
		["#666666", 1]
	]), 0.4, 0.01, (x, y) => {
		solidUpdate(x, y)

		const d = Random.bool() ? 1 : -1;
		if (grid[x][y].acts === 5 && Element.isType(x, y - 1, TYPES.AIR) && Element.isType(x + d, y - 1, TYPES.AIR)) {
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

		if (Element.isEmpty(x, y - 1)) {
			if (Element.isEmpty(x + shift, y - 1) && Element.inBounds(x + shift, y - 1)) {
				if (Random.bool(.001)) {
					//soundEffects.eurm.frequency++;
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
		if (!Element.ORThreeChecks(x, y + 1, GRASS_GROWABLE)) Element.die(x, y);
	}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.6) ? (Random.bool(.2) ? TYPES.ASH : TYPES.SMOKE) : TYPES.STEAM);
	}),

	[TYPES.FLOWER]: new Element(5, [Color.RAZZMATAZZ, Color.RAZZMATAZZ, Color.RAZZMATAZZ, Color.RED, Color.SKY_BLUE, Color.CYAN, Color.LAVENDER, Color.MAGENTA, Color.PINK, Color.YELLOW, Color.WHITE, Color.ORANGE], 0.05, .07, (x, y) => {
		let arr = Element.getNeighborsOfType(x, y, TYPES.GRASS)
		if (arr[0] || arr[2] || arr[6]) Element.setCell(x, y, TYPES.GRASS);

		if(Element.isEmpty(x, y - 1)){
			if(Random.bool(.00002)){
				Element.setCell(x, y - 1, TYPES.BEE)
				grid[x][y - 1].acts = -3;
			}
			if(Random.bool(.000001) && Element.isEmpty(x, y - 2)){
				Element.setCell(x, y - 1, TYPES.DAMSELFLY)
				Element.setCell(x, y - 2, TYPES.DAMSELFLY)
				if(Element.isEmpty(x, y - 3)) Element.setCell(x, y - 3, TYPES.DAMSELFLY)
			}
			if(Random.bool(.00000001)) Element.setCell(x, y - 1, TYPES.ANT)
			else Element.updateCell(x, y)
		}
		if (!Element.ORThreeChecks(x, y + 1, GRASS_GROWABLE)) Element.die(x, y);
	}, (x, y) => {
		if (Element.isEmpty(x, y - 1)) {
			if (Math.random() < .6) Element.trySetCell(x, y - 1, Random.bool(.3) ? TYPES.ASH : TYPES.SMOKE);
			else Element.setCell(x, y - 1, TYPES.STEAM);
		}
	}),

	[TYPES.WATER]: new Element(0, [new Color("#120a59"), new Color("#140960")], 0.4, 0.05, (x, y) => {
		if (Random.bool(0.01)) {

			// let arr = (Element.getNeighborsOfType(x, y, TYPES.ICE));
			// let coldCount = (arr.reduce((a, b) => a + b));
			// let AirCount = Element.getNeighborsOfType(x, y, TYPES.AIR).reduce((a,b) => a+b);
			// if (Random.bool(0.0001 * (9 - AirCount))) {
			// 	if ((!coldCount) && Random.bool(0.1) || (AirCount < 3 && Random.bool(0.5))) {
			// 		// Element.setCell(x, y, TYPES.WATER_VAPOR);
			// 	}else {
			// 		if(coldCount) element.setCell(x, y, TYPES.ICE);
			// 	}
			// 	Element.updateCell(x, y);
			// }
		}
		liquidUpdate(x, y, soundEffects.liquidSound, WATER_PASSTHROUGH);
	}, (x, y) => {
		Element.setCell(x, y, TYPES.STEAM);
		return true;
	}),
	[TYPES.SALT_WATER]: new Element(0, freqColoring([
		["#06253d", 1],
		["#042438", 1]
	]), 0.42, 0.05, (x, y) => {
		liquidUpdate(x, y, soundEffects.liquidSound, WATER_PASSTHROUGH);
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

	[TYPES.POND_WATER]: new Element(0, freqColoring([
		["#495933", 1],
		["#55663e", 1]
	]), 0.42, 0.05, (x, y) => {
		if(Random.bool(.00001) && Element.isEmpty(x, y - 1)) Element.setCell(x, y - 1, TYPES.LIGHTNING_BUG);
		fluidUpdate(x, y, 1, GRAVITY, WATER_PASSTHROUGH);
		//if (Random.bool(.5)) {
		const angle = Random.angle();
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		Element.tryMove(x, y, Math.round(x + cos), Math.round(y + sin), POND_WATER_SWAP_PASSTHOUGH)
		//Element.updateCell(x, y);
		//}
	}, (x, y) => {
		Element.setCell(x, y, TYPES.STEAM);
		return true;
	}),

	[TYPES.POWER_LAVA]: new Element(100, [Color.CYAN, Color.BLUE, Color.SKY_BLUE], 0.7, 0, (x, y) => {
		liquidUpdate(x, y, soundEffects.lavaSound);

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
		liquidUpdate(x, y, soundEffects.lavaSound);

		lavaUpdate(x, y, TYPES.FIRE);

		if (Random.bool(.0005)) Element.react(x, y - 1, TYPES.AIR, TYPES.FIRE);
		if (Element.consumeReactMany(x, y, WATER_TYPES, TYPES.STONE))
			soundEffects.solidifySound.frequency++;

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
	]), 0.1, 0.35, (x, y) => null, (x, y) => {
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

	}, 0.5, 0.05, (x, y) => {if (Random.bool(.004)) Element.trySetCell(x, y + 1, TYPES.ROOT, SOIL_TYPES);}, (x, y) => {
		Element.trySetCell(x, y - 1, Random.bool(.1) ? TYPES.ASH : TYPES.SMOKE);
	}),

	[TYPES.HONEY]: new Element(0, [new Color("#996211"), new Color("#8c590d")], 0.7, 0.05, (x, y) => {
		fluidUpdate(x, y, 1, GRAVITY, WATER_PASSTHROUGH);
	}, (x, y) => {
		Element.trySetCell(x, y - 1, TYPES.STEAM);
		// Element.setCell(x, y, (Random.bool(0.80)) ?  TYPES.SUGAR : TYPES.CARMEL);
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
	], 0.1, 0.05, (x, y) => {
		if(!Element.touchingMany(x, y, OTHER_GAS) && Random.bool(.0005)) Element.setCell(x, y, TYPES.HONEY); 

		if(Element.touching(x, y, TYPES.FLOWER) && Random.bool(.07) && grid[x][y].acts !== 1) grid[x][y].acts++;
		//pollenating
		if(grid[x][y].acts === 1 && Element.isEmpty(x, y + 1)){
			// seeding
			if(Random.bool(.005)){
				Element.setCell(x, y + 1, Random.bool(.90) ? TYPES.SUNFLOWER_SEED : (Random.bool(.75) ? TYPES.THICKET_SEED : TYPES.TREE_SEED))
				grid[x][y].acts = -3;
			}
			
			// building
			if(Element.touchingMany(x, y, BEE_BUILDABLE)){
				Element.setCell(x, y + 1, TYPES.HIVE);
				grid[x][y].acts = -3;
			}
		}
		chaosUpdate(x, y, LIQUID_PASSTHROUGH);
		soundEffects.mmmm.frequency++;
	}, (x, y) => {
		Element.die(x, y);
		makeCircle(x, y - 1, TYPES.HONEY, 2);
		explode(x, y - 1, 2);
	}),

	[TYPES.MINNOW]: new Element(2, [
		new Color("#c5d6a1"), new Color("#97a37c"),
		new Color("#9fad93"), new Color("#b4c9a1"),
		new Color("#a3ab9b"), new Color("#8d9487")
	], 0.1, 0.03, (x, y) => {
		if(Element.touchingMany(x, y, WATER_TYPES)){
			if(Random.bool(.005) && Element.isTypes(x, y - 1, OTHER_GAS)) createParticle(new Vector2(x, y), new Vector2(Random.range(-1, 1), Random.range(-2.5, -1)));
			chaosUpdate(x, y, SOLID_PASSTHROUGH);
		}
		else {
			solidUpdate(x, y)
			if(Element.touchingMany(x, y, OTHER_GAS)){
				if(Random.bool(.003)) createParticle(new Vector2(x, y), new Vector2(Random.range(-.7, .7), Random.range(-.6, -.1)));
				else Element.updateCell(x, y);
			}

			if(Random.bool(.0005)) Element.setCell(x, y, TYPES.BONE_DUST);
		}
	}, (x, y) => {
		Element.setCell(x, y, TYPES.AIR)
		makeCircle(x, y - 1, TYPES.BONE_DUST, 2);
		explode(x, y - 1, 2);
	}),

	[TYPES.LIGHTNING_BUG]: new Element(2, (x, y) => {
		if(grid[x][y].acts === 1) return new Color(Random.bool() ? "#f78f28ff" : "#f59b42dd")
		else return Random.choice(freqColoring([
			["#1f170b01", 1], ["#17110701", 1], ["#0a070301", 1], ["#18120d01", 1], ["#24221f01", 1]
		]))
	}, 0.1, 0.03, (x, y) => {
		if(!Element.touchingMany(x, y, OTHER_GAS) && Random.bool(.0005)) Element.setCell(x, y, TYPES.ASH); 

		if(grid[x][y].acts === 0 && Random.bool(.003)) grid[x][y].acts++;
		if(grid[x][y].acts === 1 && Random.bool(.03)) grid[x][y].acts--;

		if(Random.bool(.7)) chaosUpdate(x, y, LIQUID_PASSTHROUGH);
		else Element.updateCell(x, y);		
	}, (x, y) => {
		Element.trySetCell(x, y-1, TYPES.LIGHTNING)
	}),

	[TYPES.MITE]: new Element(2, [
		new Color("#805241"), new Color("#8c513b"),
		new Color("#8f6150"), new Color("#785b43"),
		new Color("#8a4a41"), new Color("#94564d")
	], 0.1, 0.1, (x, y) => {
		if(!Element.touchingMany(x, y, OTHER_GAS) && Random.bool(.001)) Element.setCell(x, y, TYPES.RUST); 
		if(Random.bool(.00001)) Element.setCell(x, y, TYPES.RUST);
		solidUpdate(x, y)
		if(Element.touchingMany(x, y, MITE_EATABLE_DEFENDING)) Element.setCell(x, y, TYPES.RUST); 
		Element.consumeReactMany(x, y, MITE_EATABLE, TYPES.MITE, .3);
		if(Random.bool(.05)) createParticle(new Vector2(x, y), new Vector2(Random.range(-1, 1), Random.range(-2, -.1)));
		else Element.updateCell(x, y);
	}, (x, y) => {
		Element.setCell(x, y, TYPES.AIR)
		makeCircle(x, y - 1, TYPES.RUST, 2);
		explode(x, y - 1, 2);
	}),

	[TYPES.DAMSELFLY]: new Element(2, [
		new Color("#34eb95"), new Color("#1ac45e"),
		new Color("#1fb3d1"), new Color("#28d1c6"),
		new Color("#2ee885"), new Color("#24c4e0")
	], 0.1, 0.05, (x, y) => {
		if(!Element.touchingMany(x, y, OTHER_GAS) && Random.bool(.0005)) Element.setCell(x, y, TYPES.BLOOD); 
		boidUpdate(x, y, 2, 0.2, LIQUID_PASSTHROUGH);
	}, (x, y) => {
		Element.setCell(x, y, TYPES.AIR)
		makeCircle(x, y - 1, TYPES.BLOOD, 2);
		explode(x, y - 1, 2);
	}),

	[TYPES.ANT]: new Element(2, [new Color("red")], 0.08, 0.05, (x, y) => {
		if(!Element.touchingMany(x, y, OTHER_GAS) && Random.bool(.0005)) Element.setCell(x, y, TYPES.SALT); 

		let dy2 = Random.bool() ? -1 : 1;
		if (Element.isTypes(x - 1, y, ANT_UNSTICKABLE) && Element.isTypes(x + 1, y, ANT_UNSTICKABLE)) {
			const { vel } = grid[x][y];
			vel.y += GRAVITY;
			const dx = Random.bool(.5) ? -1 : 1;
			const dy = 1 + Math.round(vel.y);
			if (Element.tryMove(x, y, x + dx, y + dy, SOLID_PASSTHROUGH));
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
		Element.setCell(x, y, TYPES.AIR)
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
					synthSoundEffects.acidSound.frequency++;
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
			synthSoundEffects.electricitySound.frequency++;

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
				
				// if (Element.isTypes(ox, oy, GROUND)){
				// 	Element.dereference(x, y);
				// 	cell.acts = 1000;
				// 	blocked = true;
				// 	break;
				// }
				if (!Element.isEmptyReference(ox, oy, ELECTRICITY_PASSTHROUGH)) {
					blocked = true;
					break;
				}
				if (!Element.isType(ox, oy, TYPES.ELECTRICITY) /* && !blocked */) {
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
		if(x % 20 === 0 || y % 20 === 0) return new Color("#918b8401");
		if(x % 20 === 19 || y % 20 === 1) return new Color("#f2efeb01");
		else return new Color(Random.choice(["#c4bdb701", "#cfc9c401", "#bab1a901"]));
	}, 0.6, 0, (x, y) => {
		if (Element.isType(x, y - 1, TYPES.GLAZE_BASE))
			Element.permeate(x, y, TYPES.TILE_BASE, TYPES.BRICK, TYPES.GLAZE_BASE, 4);
	}),
	[TYPES.DECUMAN_TILE]: new Element(1, (x, y) => {
		if(x % 60 === 0 || y % 60 === 0) return new Color("#26435901");
		if(x % 60 === 59 || y % 60 === 1) return new Color("#6888a101");
		if((x % 60 !== 0 && Math.ceil(x / 60) % 2 === 0) && (y % 60 !== 0 && Math.ceil(y / 60) % 2 === 0)){
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

		if(x % 15 === 0 || y % 15 === 0) return new Color("#26435901");
		if(x % 15 === 14 || y % 15 === 1) return new Color("#6888a101");
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
			let newID = grid[tx][ty].id;
			do {
				newID = (newID + change + ELEMENT_COUNT) % ELEMENT_COUNT;
			} while (RADIUM_SKIP.has(newID));//=== TYPES.BAHHUM);
			Element.setCellId(tx, ty, newID);
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

	[TYPES.ANTIMATTER]: new Element(1, (x, y) => {
		return Color.lerp(new Color("#36313030"), new Color("#a8878030"), Random.voronoi2D(x, y, 0.05));
	}, 0, 0, (x, y) => {
		if (!chaosUpdate(x, y, ANTIMATTER_PASSTHROUGH)) {
			Element.die(x, y);
			makeCircle(x, y, Random.choice([TYPES.LIGHT, TYPES.ACTINIUM, TYPES.THORIUM]), 5);
			explode(x, y, 40);
		}
	}),

	[TYPES.LIGHTNING]: new Element(80, [new Color(100, 100, 200), Color.WHITE], 0.01, 0, (x, y) => {
		const cell = grid[x][y];
		if (cell.acts === -1) {
			const ox = x + Random.int(-1, 1);
			const oy = y + Random.int(-1, 1);
			if (Random.bool(0.1)) Element.die(x, y);
			else Element.tryMove(x, y, ox, oy);
		} else if (cell.acts === 0) {
			synthSoundEffects.lightningSound.frequency++;

			cell.acts++;
			const dx = Random.bool() ? -1 : 1;
			const len = Random.int(5, 10);
			let ox = x;
			for (let i = 0; i < len; i++) {
				ox += Random.bool(0.99) ? -dx : dx;
				const oy = y + i;
				if (Element.trySetCell(ox, oy, TYPES.LIGHTNING, LIQUID_PASSTHROUGH)) {
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
				} else if(Element.isType(ox, oy, TYPES.SAND)){
					Element.setCell(ox, oy, TYPES.LIGHTNING);
					grid[ox][oy].reference = TYPES.GLASS;
					if (i < len - 1) {
						grid[ox][oy].acts++;

						if (Random.bool(0.1)) {
							// console.log("split");
							if (Element.isEmpty(x - dx * i, y + i, LIGHTNING_PASSTHROUGH)) {
								console.log(typeName(grid[x - dx * i][y + i].id));
								grid[x - dx * i][y + i].id = TYPES.LIGHTNING;
							}
							// Element.setCellId(x - dx * i, y + i, TYPES.LIGHTNING, LIGHTNING_PASSTHROUGH);
							// Element.setCellId(x + dx * i, y + i, TYPES.LIGHTNING, LIGHTNING_PASSTHROUGH);		
							// const ox = x + Random.int(-5, 5);
							// const oy = y + Random.int(-5, 5);
							// if (Element.trySetCell(ox, oy, TYPES.LIGHTNING)) {
							// 	grid[ox][oy].acts--;
							// }

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
		} else if (cell.acts++ > 10){
			if(cell.reference === TYPES.GLASS){
				Element.dereference(x, y);
			}else Element.die(x, y);
		}

		if(cell.reference === TYPES.GLASS){
			cell.acts++;
		}
		Element.updateCell(x, y);
	}, (x, y) => null),//, true),

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
const ZOOM_SENSITIVITY = 0.1;
let SELECTORS_SHOWN = true;
let SETTINGS_SHOWN = false;

const BRUSH_TYPES = Object.fromEntries([
	"CIRCLE", "SQUARE", "RING", "FORCEFUL", "ROW", "COLUMN", "SELECT", "DUPLICATE",  "LINE", "UPDATE"
].map((v, i) => [v, i]));
function brushTypeName(brushType) {
	const name = Object.entries(BRUSH_TYPES)
		.find(([name, inx]) => inx === brushType)[0];
	return name[0] + name.slice(1).toLowerCase();
};
const BRUSH_TYPE_COUNT = Object.keys(BRUSH_TYPES).length;
let brushType = 0;
let eraseOnly = false;
let secretBrush = false;

// selection
let brushSelectMin = null;
let brushSelectMax = null;
let brushSelection = null;
let brushSelectionTex = null;
let lineDrawingPoints = [];
let lastDrawingPoint = undefined;
const drawingRange = 5;
let debugColor1 = Color.RED;
let debugColor2 = Color.PURPLE; 
let currentDebugColor = debugColor1;

let debugColorInterval = 7;
let debugOscillating = false; //COOL feature

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
		const { world, justPressed } = touches.get(touch);

		const hovered = scene.main.getElementsWithScript(TYPE_SELECTOR).some(el => !el.hidden && el.collidePoint(world));

		if (hovered) {
			anyHovered = true;
			continue;
		}

		const { x: ox, y: oy } = Vector2.floor(world.over(CELL));
		const { x: oxl, y: oyl } = Vector2.floor(mouse.worldLast.over(CELL));

		if (brush === TYPES.PARTICLE) {
			explode(ox, oy, r);
			eventSoundEffects.explosionSound.frequency--;
		}
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
					} else if (brush === TYPES.AIR || Element.isEmpty(x, y)){
						let otherBrush;
						do {
							otherBrush = Math.floor(Random.range(0, ELEMENT_COUNT));
						} while (otherBrush === TYPES.BAHHUM);
						Element.setCell(x, y, secretBrush ? otherBrush : brush);
					}
				}
			};
			// const freezeParticle = (x, y) => {
			// 	if (Element.inBounds(x, y)) {
			// 		particles.filter((p, index, arr) => 
			// 			(Math.abs(p.position.x - x) < 1) && (Math.abs(p.position.y - y) < 1) && (Element.isEmpty(x, y))
			// 		).forEach((particle, index, arr)=>{
			// 			particle.solidify();
			// 		});
			// 	}
			// }
			const handleLine = (x, y, x1, y1, chance = 0.2, passthrough = undefined) => {
				const minX = Math.min(x, x1) - r;
				const minY = Math.min(y, y1) - r;
				const maxX = Math.max(x, x1) + r;
				const maxY = Math.max(y, y1) + r;
				const line = new Line(x, y, x1, y1);
				for (let i = minX; i <= maxX; i++) for (let j = minY; j <= maxY; j++) {
					const p = new Vector2(i, j);
					if (Element.inBounds(i, j) && line.distanceTo(p) < r) {
						handleCell(i,j);
					}
				}
			}
			switch (brushType) {
				case BRUSH_TYPES.CIRCLE: {
					for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
						if (i * i + j * j < r * r) {
							const x = i + ox;
							const y = j + oy;
							handleCell(x, y);
						}
					}
				}; break;
				case BRUSH_TYPES.SQUARE: {
					let or = r - 1;
					for (let i = -or; i <= or; i++) for (let j = -or; j <= or; j++) {
						const x = i + ox;
						const y = j + oy;
						handleCell(x, y);
					}
				}; break;
				case BRUSH_TYPES.RING: {
					for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
						if (i * i + j * j < r * r && i * i + j * j >= (r - 1) * (r - 1)) {
							const x = i + ox;
							const y = j + oy;
							handleCell(x, y);
						}
					}
				}; break;
				case BRUSH_TYPES.FORCEFUL: {
					const CHAOS = 1;
					const vel = 0.3;
					if(!eraseOnly){
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
					} else{
						if(brush === TYPES.AIR){
							return;
						}
						particles.filter((p, index, arr) => 
							(Vector2.dist(p.position, new Vector2(ox,oy)) < r) && (Element.isEmpty(...Vector2.floor(p.position).values))
						).forEach((particle, index, arr)=>{
							particle.solidify();
						});
					}
				}; break;
				case BRUSH_TYPES.ROW: {
					let disp = oy-oyl;
					for (let i = 0; i <= WIDTH; i++) for (let j = -(r - 1); j <= (r - 1); j++) {
						const x = i;
						const y = j + oy;
						handleCell(x, y);
					}
				}; break;
				case BRUSH_TYPES.COLUMN: {
					let disp = ox-oxl;
					for (let i = 0; i <= HEIGHT; i++) for (let j = -(r - 1); j <= (r - 1); j++) {
						const x = j + ox;
						const y = i;
						handleCell(x, y);
					}
				}; break;
				case BRUSH_TYPES.SELECT: {
					if (!brushSelectMin || justPressed) {
						brushSelectMin = new Vector2(ox, oy);
						brushSelectMax = null;
					} else {
						brushSelectMax = new Vector2(ox + 1, oy + 1);
						const { x, y, width, height } = Rect.fromMinMax(brushSelectMin, brushSelectMax)
							.clip(new Rect(0, 0, WIDTH, HEIGHT));
						if (width >= 1 && height >= 1) {
							brushSelection = Array.dim(width, height)
								.map((_, lx, ly) => grid[lx + x][ly + y].get());
							brushSelectionTex = new Texture(width, height)
								.shader((lx, ly, dest) => {
									const color = DATA[grid[lx + x][ly + y].id].getColor(lx + x, ly + y);
									dest.set(color);
									if (color.brightness) dest.alpha = 0.3;
								});
						}
					}
				}; break;
				case BRUSH_TYPES.DUPLICATE: {
					if (brushSelection) {
						for (let i = 0; i < brushSelection.length; i++)
						for (let j = 0; j < brushSelection[0].length; j++) {
							if (Element.inBounds(ox + i, oy + j)) {
								const cell = brushSelection[i][j];
								if (!cell.id) continue;
								if (eraseOnly) {
									Element.die(ox + i, oy + j);
								} else {
									cell.get(grid[ox + i][oy + j]);
									Element.updateCell(ox + i, oy + j);
								}
							}
						}
					}
				}; break;
				case BRUSH_TYPES.LINE: {
					//need to add a limiter so it doesn't create 50 of the same points, it will be rounded
					//size of the brush = size of line using make lines
					if(keyboard.pressed("k")){
						lineDrawingPoints = [];
					}
					if(keyboard.pressed("m")){
						for (let i = 0; i < lineDrawingPoints.length - 1; i++) {
							handleLine(
								...lineDrawingPoints[i].values,
								...lineDrawingPoints[i + 1].values
							);
						}
						// let prevValue;
						// let currentValue;
						// let values = lineDrawingPoints.values();
						// prevValue = lineDrawingPoints[0];
						// for (const value of lineDrawingPoints) {
						// 	currentValue = value;
						// 	handleLine(prevValue[0], prevValue[1], currentValue[0], currentValue[1]);
						// 	prevValue = currentValue;
						// }
						lineDrawingPoints = [];
					}
					if(keyboard.pressed("n")){
						const lastDrawingPoint = lineDrawingPoints.last;
						if (!lineDrawingPoints.length || Vector2.dist(lastDrawingPoint, new Vector2(ox, oy)) > drawingRange){
							lineDrawingPoints.push(new Vector2(ox, oy));
							// lastDrawingPoint = [ox,oy]
							// console.log(lastDrawingPoint);
							// console.log(lineDrawingPoints);
							// console.log(ox + " | " + oy);
							// console.log(mouse.world);
							// console.log((Math.abs(ox-lastDrawingPoint[0]) < 5) + " | " + (Math.abs(oy-lastDrawingPoint[1]) < 5));
						}// makeLine(oxl, oyl, oxl+10, oyl+10, TYPES.STONE, 5);
						//apply						
					}
				} break;

				case BRUSH_TYPES.UPDATE: {
					for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
						if (i * i + j * j < r * r) {
							const x = i + ox;
							const y = j + oy;
							Element.updateCell(x, y);
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
		for (let y = 0; y < HEIGHT; y++) {
			Element.setCell(x, y, TYPES.AIR);
			// Element.dereference(x, y);
			lastIds[x][y] = -1;
		}
		scene.main.removeElements(scene.main.getElementsWithScript(DYNAMIC_OBJECT));
		lineDrawingPoints = [];
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
					if (brushType + 1 < BRUSH_TYPE_COUNT) brushType++;
					else brushType = 0;
				} else if (key === "ArrowLeft" || key === ",") {
					if (brushType > 0) brushType--;
					else brushType = BRUSH_TYPE_COUNT - 1;
				} else if (key === "ArrowUp") brushSize++;
				else if (key === "ArrowDown") brushSize = Math.max(brushSize - 1, 1);
				else if (key === "e") {
					scene.camera.restoreZoom();
					scene.camera.position = middle;
				} else if (key === "p") {
					eraseOnly = !eraseOnly;
				} else if (key === "`") {
					secretBrush = !secretBrush;
					eraseOnly = false;
				} else if (key === "r") {
					clearAll();		
					forceRender = true;
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
						const minBounds = Vector2.origin;
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
				} else if (key === "0") brushType = 0;
				else if (key === "1") brushType = 1;
				else if (key === "2") brushType = 2;
				else if (key === "3") brushType = 3;
				else if (key === "4") brushType = 4;
				else if (key === "5") brushType = 5;
				else if (key === "6") brushType = 5;
				else if (key === "[") brush = (brush - 1 + ELEMENT_COUNT) % ELEMENT_COUNT;
				else if (key === "]") brush = (brush + 1 + ELEMENT_COUNT) % ELEMENT_COUNT;
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
		if (keyboard.justPressed("t")) {
			renderView = (renderView + 1) % renderViewCount;
			forceRender = true;
		}
		

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

	canvas.cursor = scene.main.getElementsWithScript(TYPE_SELECTOR).some(el => !el.hidden && el.collidePoint(mouse.world)) ? "pointer" : "none";
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

let renderOnVel = false;
let renderAntTrail = false;
let forceRender = false;

let renderView = 0; //0 = normal, 1 = renderOnVel, 2 = renderAntTrail
let renderViewCount = 3;

function stepGraphics() {
	const col = new Color(0, 0, 0, 1);

	for (let i = 0; i < CHUNK_WIDTH; i++) for (let j = 0; j < CHUNK_HEIGHT; j++) {
		const chunk = chunks[i][j];
		if (chunk.sleep && chunk.sleepNext && (!forceRender))
			continue;

		const cx = chunk.x * CHUNK;
		const cy = chunk.y * CHUNK;
		for (let i = 0; i < CHUNK; i++) for (let j = 0; j < CHUNK; j++) {
			const x = cx + i;
			const y = cy + j;
			if (x >= WIDTH || y >= HEIGHT)
				continue;

			const cell = grid[x][y];
			if (cell.id !== lastIds[x][y] || forceRender || (renderView)) {
				col.red = cell.id;
				const element = DATA[cell.id];
				let displayCol = new Color(0,0,0,0);
				switch (renderView) {
					case 1:
						//negative values are not included annoyingly
						displayCol.red = cell.vel.mag*50;
						displayCol.blue = (Math.abs(cell.acts))//*(255/100);
						displayCol.green =  DATA[cell.id].reference ?  (cell.reference) ? (255 * DATA[cell.reference].getColor(x, y).brightness) : 0 : 0;
						displayCol = Color.lerp(displayCol, element.getColor(x, y), 0.3)
						break;
					case 2:
						if(cell.acts != 0){
							let pheromones = antBytePaser(cell.acts);
							displayCol.red = antPheromoneValue(pheromones[1]) * toHomeWeight;
							displayCol.blue = antPheromoneValue(pheromones[0]) * toFoodWeight;
						}
						if(cell.id == TYPES.TERMITE){
							if (cell.acts == 1) {
								displayCol.blue = 255;
							}
							displayCol.green = 255;
						}
						if(cell.id == TYPES.ANT_HILL) {
							displayCol.blue = 255;
							displayCol.green = 255;
							displayCol.red = 255;
						}else if (cell.id != TYPES.TERMITE) {
							displayCol = Color.lerp(displayCol, element.getColor(x, y), 0.3)
						}
						break;
					default:
						displayCol = element.getColor(x, y)
						break;
				}
				tex.setPixel(x, y, displayCol);
				
				// if(renderOnVel){
				// 	let col2 = new Color(0,0,0,0);
				// 	col2.red = cell.vel.mag*50;
				// 	col2.blue = (Math.abs(cell.acts))*(255/8);
				// 	tex.setPixel(x, y, col2);
				// }else{
				// 	tex.setPixel(x, y, element.getColor(x, y));
				// }

				col.red = cell.id;
				idTex.setPixel(x, y, col);
				lastIds[x][y] = cell.id;
			}
		}
	}
	if (forceRender) forceRender = false;

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
		let brushPreviewArgs = [eraseOnly ? Color.RED : Color.LIME, 1 / scene.camera.zoom];
		const cellBrushSize = brushSize * CELL;
		if(secretBrush) brushPreviewArgs = [Color.PURPLE, 1 / scene.camera.zoom];
		renderer.draw(brushPreviewArgs[0]).circle(mouse.world, brushPreviewArgs[1]);
		switch (brushType) {
			case BRUSH_TYPES.CIRCLE:
				renderer.stroke(...brushPreviewArgs).circle(mouse.world, cellBrushSize);
				break;
			case BRUSH_TYPES.SQUARE:
				renderer.stroke(...brushPreviewArgs).rect(Rect.fromMinMax(mouse.world.minus(cellBrushSize), mouse.world.plus(cellBrushSize)));
				break;
			case BRUSH_TYPES.RING:
				renderer.stroke(...brushPreviewArgs).circle(mouse.world, cellBrushSize);
				renderer.stroke(...brushPreviewArgs).circle(mouse.world, cellBrushSize - CELL);
				break;
			case BRUSH_TYPES.FORCEFUL: {
				renderer.stroke(...brushPreviewArgs).shape(new Polygon(Polygon.regular(24, cellBrushSize).vertices.map((v, i) => i % 2 ? v.times(1.3) : v)).move(mouse.world));
			}; break;
			case BRUSH_TYPES.ROW:
				renderer.stroke(...brushPreviewArgs).rect(0, mouse.world.y - cellBrushSize, WIDTH * CELL, cellBrushSize * 2);
				break;
			case BRUSH_TYPES.COLUMN:
				renderer.stroke(...brushPreviewArgs).rect(mouse.world.x - cellBrushSize, 0, cellBrushSize * 2, HEIGHT * CELL);
				break;
			case BRUSH_TYPES.DUPLICATE:
				if (brushSelection)
					renderer.image(brushSelectionTex).rect(Math.floor(mouse.world.x / CELL) * CELL, Math.floor(mouse.world.y / CELL) * CELL, brushSelectionTex.width * CELL, brushSelectionTex.height * CELL);
			case BRUSH_TYPES.SELECT:
				if (brushSelectMin && brushSelectMax)
					renderer.stroke(...brushPreviewArgs).rect(Rect.fromMinMax(brushSelectMin.times(CELL), brushSelectMax.times(CELL)));
				break;
			case BRUSH_TYPES.LINE:
				renderer.stroke(...brushPreviewArgs).circle(mouse.world, cellBrushSize);
				renderer.stroke(...brushPreviewArgs).rect(Rect.fromMinMax(mouse.world.minus(cellBrushSize), mouse.world.plus(cellBrushSize)));

				// let prevValue;
				renderer.stroke(...brushPreviewArgs).connector(lineDrawingPoints.map(point => point.times(CELL)).concat([mouse.world]));
						// let currentValue;
						// let values = lineDrawingPoints.values();
						// prevValue = lineDrawingPoints[0];
						// for (const value of lineDrawingPoints) {
						// 	currentValue = value;
						// 	renderer.stroke(...brushPreviewArgs).line(prevValue[0]* CELL, prevValue[1]* CELL, currentValue[0]* CELL, currentValue[1]* CELL);
						// 	prevValue = currentValue;
						// }
					if(lineDrawingPoints.length)
						renderer.draw(Color.BLUE).circle(lineDrawingPoints.last.times(CELL), 2.5 / scene.camera.zoom);
				break;
			case BRUSH_TYPES.UPDATE:
				renderer.stroke(...brushPreviewArgs).circle(mouse.world, cellBrushSize);

				renderer.stroke(...brushPreviewArgs).rect(Rect.fromMinMax(
					new Vector2(mouse.world.x + cellBrushSize/15, mouse.world.y - cellBrushSize/1.25),	
					new Vector2(mouse.world.x - cellBrushSize/15, mouse.world.y - cellBrushSize/7.5)	
				));
				renderer.stroke(...brushPreviewArgs).rect(Rect.fromMinMax(
					new Vector2(mouse.world.x + cellBrushSize/15, mouse.world.y + cellBrushSize/(10)),	
					new Vector2(mouse.world.x - cellBrushSize/15, mouse.world.y + cellBrushSize/4)	
				))
				// renderer.textMode = TextMode.CENTER_CENTER;
				// renderer.stroke(...brushPreviewArgs).text(Font.Arial80, "!", new Vector2(
				// 	mouse.world.x,
				// 	mouse.world.y,
				// ));
		}
	});
}

function displayDebugInfo() {
	
	if (keyboard.pressed("v")) {
		if (!debugFrame)
			debugFrame = new FastFrame(width, height);

		debugFrame.renderer.transform = scene.camera;

		if (debugOscillating) {
			const time = intervals.frameCount;
			if (time % debugColorInterval === 0 && currentDebugColor === debugColor1) currentDebugColor = debugColor2;
			else if (time % debugColorInterval === 0) currentDebugColor = debugColor1;
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

class SynthSoundEffect {
	constructor({
		maxPerFrame = Infinity,
		chance = 1,
		...props
	}) {
		this.chance = chance;
		this.props = props,
		this.maxPerFrame = maxPerFrame;
		this.frequency = 0;
		this.toPlay = 0;
	}
	update() {
		this.toPlay += Math.min(this.maxPerFrame, this.frequency * this.chance);
		
		const count = Math.floor(this.toPlay);
		for (let i = 0; i < count; i++) {
			const props = {};
			for (const key in this.props) {
				const prop = this.props[key];
				props[key] = typeof prop === "function" ? prop() : prop;
			} 
			synth.play(props);
			this.toPlay--;
		}
		
		this.frequency = 0;
	}
}

const synthSoundEffects = Object.fromEntries(Object.entries(SYNTH_SOUND_EFFECTS).map(
	([sound, props]) => [sound, new SynthSoundEffect(props)]
));

class EventSoundEffect {
	constructor(src, {
		chance = 1,
		maxPerFrame = Infinity,
		volume = 1,
		variations = 1
	}) {
		this.sounds = [];
		if (variations === 1)
			this.sounds.push(loadResource(src + ".mp3"));
		else for (let i = 0; i < variations; i++)
			this.sounds.push(loadResource(src + i + ".mp3"));
		this.chance = chance;
		this.volume = volume;
		this.frequency = 0;
		this.maxPerFrame = maxPerFrame;
		this.toPlay = 0;
	}
	update() {
		this.toPlay += Math.min(this.maxPerFrame, this.frequency * this.chance);

		const count = Math.floor(this.toPlay);
		for (let i = 0; i < count; i++) {
			Random.choice(this.sounds).play(this.volume);
			this.toPlay--;
		}
		
		this.frequency = 0;
	}
}

const eventSoundEffects = Object.fromEntries(
	Object.entries(EVENT_SOUND_EFFECTS).map(([sound, props]) => [sound, new EventSoundEffect(sound, props)])
);

class BlendedEffectInstance {
	constructor(sound, volume) {
		this.sound = sound;
		this.instances = [sound.play(volume)];
		this.volume = volume;
	}
	update() {
		for (let i = 0; i < this.instances.length; i++)
			if (this.instances[i].isDone)
				this.instances[i] = this.sound.play(this.volume);

		if (this.instances.length === 1 && this.instances[0].time > this.sound.duration * 0.5) {
			this.instances.push(this.sound.play(this.volume / 2));
			this.instances[0].volume = this.volume / 2;
		}
	}
	stop() {
		for (let i = 0; i < this.instances.length; i++)
			this.instances[i].stop();
	}
	set volume(v) {
		this._volume = v;
		for (let i = 0; i < this.instances.length; i++)
			this.instances[i].volume = v / this.instances.length;
	}
	get volume() {
		return this._volume;
	}
}

class SoundEffectState {
	static MAX_INSTANCES = 4;
	static DENSITY_INTERPOLATE = 0.1;
	static TIME_STAGGERING = 30;
	constructor(sound, {
		maxFrequency = 100,
		volume = 1
	}) {
		this.sound = loadResource(sound + ".mp3");
		this.frequency = 0;
		this.instances = [];
		this.lastDensity = 0;
		this.maxFrequency = maxFrequency;
		this.volume = volume;
		this.timeSinceStarted = Infinity;
	}
	update() {
		const density = Number.clamp(this.frequency / this.maxFrequency, 0, 1);
		this.lastDensity += (density - this.lastDensity) * SoundEffectState.DENSITY_INTERPOLATE;
		const instContinuous = Number.clamp(this.lastDensity - 0.01, 0, 1) * SoundEffectState.MAX_INSTANCES;
		const instCount = Math.ceil(instContinuous);
		const lastInstVolume = instContinuous % 1;

		while (this.instances.length > instCount)
			this.instances.pop()?.stop?.();
		this.instances.length = instCount;
		for (let i = 0; i < instCount; i++) {
			const volume = this.volume * ((i === instCount - 1) ? lastInstVolume : 1);
			if (this.instances[i])
				this.instances[i].volume = volume;
			else if (this.timeSinceStarted > SoundEffectState.TIME_STAGGERING) {
				this.instances[i] = new BlendedEffectInstance(this.sound, volume);
				this.timeSinceStarted = 0;
			}
			this.instances[i]?.update();
		}

		this.timeSinceStarted++;

		this.frequency = 0;
	}
};

const soundEffects = Object.fromEntries(Object.entries(SOUND_EFFECTS)
	.map(([sound, props]) => [sound, new SoundEffectState(sound, props)]
));

const allSoundEffects = [soundEffects, eventSoundEffects, synthSoundEffects];

function updateSoundEffects() {
	for (let i = 0; i < allSoundEffects.length; i++) {
		const effect = allSoundEffects[i];
		const keys = Object.keys(effect);
		for (let i = 0; i < keys.length; i++)
			effect[keys[i]].update();
	}
}

let debugAccuracy = 3;
debugAccuracy = 10**debugAccuracy;

intervals.continuous(time => {
	// try {

		handleInput();
		injectDynamicBodies();
		handleBrushInput();
		
		const singleStep = keyboard.justPressed("Enter");
		//just a added script, if shift and enter is pressed then the sim will just constantly run even when paused
		const stepping = keyboard.pressed("Shift") && keyboard.pressed("Enter");

		const simStep = !paused || singleStep || stepping;
		if (simStep) {
			//cell sim step
			stepSimulation(time);
			simFrameCount++;
			//particle sim step
			stepParticles();
		}
		
		stepGraphics();
		if (!renderOnVel)
			stepParticleGraphics();
		extractDynamicBodies(); // also displays them
		
		if (simStep) stepSleeping();

		displayWorld();
		displayBrushPreview();
		displayDebugInfo();

		updateSoundEffects();

		
		if (!SELECTORS_SHOWN) {
			const coord =  Vector2.floor(mouse.world.over(CELL));
			let hoveredElementType = TYPES.AIR;
			let hoveredElementActs = 0;
			let hoveredElementRef = 0;
			let hoveredElementVelInfo = 0;
			{
				if (Element.inBounds(coord.x, coord.y)) {
					hoveredElementType = grid[coord.x][coord.y].id;
					hoveredElementActs = grid[coord.x][coord.y].acts;
					hoveredElementRef = DATA[hoveredElementType].reference ? grid[coord.x][coord.y].reference : 0;
					hoveredElementVelInfo = Vector2.round(grid[coord.x][coord.y].vel.times(debugAccuracy)).over(debugAccuracy);
				}
			};
			
			renderer.textMode = TextMode.TOP_LEFT;
			text(Font.Arial20, `brush: ${typeName(brush)}, brushSize: ${brushSize}, brushType: ${brushTypeName(brushType)} | ${brushType}, paused: ${paused}, RTX: ${RTX}, RenderState: ${renderView}, fps: ${intervals.fps}`, 10, 10);
			renderer.textMode = TextMode.TOP_RIGHT;
			text(Font.Arial15, hoveredElementType ? typeName(hoveredElementType) + (hoveredElementActs ? " (" + hoveredElementActs + ")" : "") + (hoveredElementRef ? " {" + typeName(hoveredElementRef) + "}" : "") : "", width - 10, 10);
			
			if (keyboard.pressed("v")) {
				renderer.textMode = TextMode.BOTTOM_LEFT;
				text(Font.Arial15, 
					(!Element.inBounds(coord.x, coord.y)) ? "" : "coords: " + coord +
					((hoveredElementVelInfo) ? "\nVel Info: " + hoveredElementVelInfo + " m: " + Math.round(hoveredElementVelInfo.mag*debugAccuracy)/debugAccuracy : "") +
					((hoveredElementActs) ? "\nActs: " + hoveredElementActs : "") + 
					((hoveredElementActs) ? "\nto Home: " + Math.round( antPheromoneValue( antBytePaser(hoveredElementActs)[0] ) * debugAccuracy ) / debugAccuracy + "\t to Food:" +  Math.round( antPheromoneValue( antBytePaser(hoveredElementActs)[1] ) * debugAccuracy ) / debugAccuracy: "") + 
					((hoveredElementRef) ? "\nReference: " + '\u27e8' + typeName(hoveredElementRef) + '\u27e9': "")
					, 10, height - 10);	
			}
			
		}
	// } catch (err) {
	// 	alert(err + "\n" + err.stack);
	// }
}, IntervalFunction.UPDATE);
