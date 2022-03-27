import {
	RepeatWrapping,
	DoubleSide,
	PointLight,
	PCFSoftShadowMap,
	Scene,
	PerspectiveCamera,
	WebGLRenderer,
	Color,
	ACESFilmicToneMapping,
	sRGBEncoding,
	Mesh,
	SphereGeometry,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PMREMGenerator,
	FloatType,
	BoxGeometry,
	CylinderGeometry,
	Vector2,
	Vector3,
	TextureLoader,
	MeshPhysicalMaterial,
	Fog,
	Clock,
	AnimationMixer,
	Raycaster,
	AmbientLight,
	MeshPhongMaterial,
	BoxBufferGeometry,
} from "https://cdn.skypack.dev/three@0.137";
import { RGBELoader } from "https://cdn.skypack.dev/three-stdlib@2.8.5/loaders/RGBELoader";
import { OrbitControls } from "https://cdn.skypack.dev/three-stdlib@2.8.5/controls/OrbitControls";
import { mergeBufferGeometries } from "https://cdn.skypack.dev/three-stdlib@2.8.5/utils/BufferGeometryUtils";
import SimplexNoise from "https://cdn.skypack.dev/simplex-noise";
import { GLTFLoader } from "https://cdn.skypack.dev/three-stdlib@2.8.5/loaders/GLTFLoader";

let physicsWorld;
let rigidBody_List = new Array();
let tmpTransformation = undefined;

let clock, scene, camera, renderer, controls;
let raycaster = new Raycaster();
let tmpPos = new Vector3();
let mouseCoords = new Vector2();

Ammo().then(start)

function start() {
	tmpTransformation = new Ammo.btTransform();
	initPhysicsWorld(); // DONE
	initGraphicsWorld(); // DONE

	createHex(); // DONE
	createDropCubes(); // DONE

	addEventhandlers(); // DONE

	console.log("Script started!");
};

function initPhysicsWorld() {
	let collisionConfiguration = new Ammo.btDefaultCollisionConfiguration(),
		dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration),
		overlappingPairCache = new Ammo.btDbvtBroadphase(),
		solver = new Ammo.btSequentialImpulseConstraintSolver();

	physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
	physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));

	console.log("Physics-World initialized.");
};

function initGraphicsWorld() {
	clock = new Clock();

	scene = new Scene();
	scene.background = new Color("#FFEECC");

	camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000);
	camera.position.set(-17, 31, 33);
	camera.lookAt(0, 0, 0);

	// let ambientLight = new AmbientLight( 0xcccccc, 0.5 );
	// ambientLight.position.set( 0, 10, 0 );
	// scene.add(ambientLight);

	renderer = new WebGLRenderer({ antialisa: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setSize(innerWidth, innerHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
	// document.body.appendChild(renderer.domElement);
	document.body.append(renderer.domElement);
	renderer.toneMapping = ACESFilmicToneMapping;
	renderer.outputEncoding = sRGBEncoding;
	renderer.physicallyCorrectLights = true;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;

	const light = new PointLight( new Color("#FFCB8E").convertSRGBToLinear().convertSRGBToLinear(), 80, 200 );
	light.position.set(10, 20, 10);
	light.castShadow = true;
	light.shadow.mapSize.width = 512; 
	light.shadow.mapSize.height = 512; 
	light.shadow.camera.near = 0.5; 
	light.shadow.camera.far = 500; 
	scene.add( light );

	scene.fog = new Fog(0xffffff, 200, 1000);

	controls = new OrbitControls(
		camera, renderer.domElement
	);
	controls.target.set(0, 0, 0);
	controls.dampingFactor = 0.05;
	controls.enableDamping = true;

	(async function() {
		let pmrem = new PMREMGenerator(renderer);
		let envmapTexture = await new RGBELoader().setDataType(FloatType).loadAsync("assets/lilienstein_4k.hdr");
		envmap = pmrem.fromEquirectangular(envmapTexture).texture;
	
		let textures = {
			dirt: await new TextureLoader().loadAsync("texture_assets/dirt.png"),
			dirt2: await new TextureLoader().loadAsync("texture_assets/dirt2.jpg"),
			grass: await new TextureLoader().loadAsync("texture_assets/grass.jpg"),
			sand: await new TextureLoader().loadAsync("texture_assets/sand.jpg"),
			stone: await new TextureLoader().loadAsync("texture_assets/stone.png"),
			water: await new TextureLoader().loadAsync("texture_assets/water.jpg"),
		};
		
		let simplex = new SimplexNoise();
		
		for (let i = -15; i <= 15; i++) {
			for (let j = -15; j <= 15; j++) {
				let position = tileToPosition(i, j);
	
				if (position.length() > 16) continue;
	
				let noise = (simplex.noise2D(i * 0.1, j * 0.1) + 1) * 0.5;
				noise = Math.pow(noise, 1.5);
				makeHex(noise * MAX_HEIGHT, position);
			}
		}

		let stoneMesh = hexMesh(stoneGeo, textures.stone);
		let grassMesh = hexMesh(grassGeo, textures.grass);
		let dirt2Mesh = hexMesh(dirt2Geo, textures.dirt2);
		let dirtMesh = hexMesh(dirtGeo, textures.dirt);
		let sandMesh = hexMesh(sandGeo, textures.sand);
		scene.add(stoneMesh, grassMesh, dirt2Mesh, dirtMesh, sandMesh);

		let seaTexture = textures.water;
		seaTexture.repeat = new Vector2(1, 1);
		seaTexture.wrapS = RepeatWrapping;
		seaTexture.wrapT = RepeatWrapping;

		let seaMesh = new Mesh(
			new CylinderGeometry(
				17, 17, MAX_HEIGHT * 0.2, 50),
			new MeshPhysicalMaterial({
	    		envMap: envmap,
			    color: new Color("#55aaff").convertSRGBToLinear().multiplyScalar(3),
			    ior: 1.4,
			    transmission: 1,
			    transparent: true,
			    thickness: 1.5,
			    envMapIntensity: 0.2, 
			    roughness: 1,
			    metalness: 0.025,
			    roughnessMap: seaTexture,
			    metalnessMap: seaTexture,
	    	})
		);
		seaMesh.receiveShadow = true;
		seaMesh.rotation.y = -Math.PI * 0.333 * 0.5;
		seaMesh.position.set(0, MAX_HEIGHT * 0.1, 0);
		seaMesh.name = "Sea-Cylinderical-Mesh";
		scene.add(seaMesh);

		floorObj(textures, envmap);

		let cloudGroup = clouds();
		scene.add(cloudGroup);
		cloudGroup.position.y += 10;
	
		createPlayer("Plane.glb");
	
		renderer.setAnimationLoop(() => {
			if (PlaneMesh) {
				camera.lookAt(PlaneMesh.position.x, PlaneMesh.position.y, PlaneMesh.position.z);
			}
			controls.update();
			let deltaTime = clock.getDelta();
			updatePhysicsWorld(deltaTime);
			renderer.render(scene, camera);
			seaMesh.rotation.y -= 0.0015;
			cloudGroup.rotation.y += 0.003;
		});
	console.log("Async function being executed.");
	})();
	
	console.log("Graphics-World initialized.");
};

let envmap;
let mixer;
let PlaneMesh;
const MAX_HEIGHT = 10;
const STONE_HEIGHT = MAX_HEIGHT * 0.8;
const DIRT_HEIGHT = MAX_HEIGHT * 0.7;
const GRASS_HEIGHT = MAX_HEIGHT * 0.5;
const SAND_HEIGHT = MAX_HEIGHT * 0.3;
const DIRT2_HEIGHT = MAX_HEIGHT * 0.0;

function tileToPosition(tileX, tileY) {
	return new Vector2(
		(tileX + (tileY % 2) * 0.5) * 1.77,
		tileY * 1.535
	);
}

let stoneGeo = new BoxGeometry(0, 0, 0);
let dirtGeo = new BoxGeometry(0, 0, 0);
let dirt2Geo = new BoxGeometry(0, 0, 0);
let sandGeo = new BoxGeometry(0, 0, 0);
let grassGeo = new BoxGeometry(0, 0, 0);

function hexGeometry(height, position) {
	let geo = new CylinderGeometry(1, 1, height, 6, 1, false);
	geo.translate(position.x, height * 0.5, position.y);

	return geo;
}

function makeHex(height, position) {
	let geo = hexGeometry(height, position);

	if (height > STONE_HEIGHT) {
		stoneGeo = mergeBufferGeometries([geo, stoneGeo]);

		if (Math.random() > 0.8) {
			stoneGeo = mergeBufferGeometries([stoneGeo, stone(height, position)]);
		}
	}
	else if (height > DIRT_HEIGHT) {
		dirtGeo = mergeBufferGeometries([geo, dirtGeo]);
		if (Math.random() > 0.8) {
			grassGeo = mergeBufferGeometries([grassGeo, tree(height, position)]);
		}
	}
	else if (height > GRASS_HEIGHT) {
		grassGeo = mergeBufferGeometries([geo, grassGeo]);
	}
	else if (height > DIRT2_HEIGHT) {
		dirt2Geo = mergeBufferGeometries([geo, dirt2Geo]);
	}
	else if (height > SAND_HEIGHT) {
		sandGeo = mergeBufferGeometries([geo, sandGeo]);

		if (Math.random() > 0.8 && stoneGeo) {
			stoneGeo = mergeBufferGeometries([geo, dirt2Geo]);
		}
	}
}

function hexMesh(geo, map) {
	let mat  = new MeshPhysicalMaterial({
		envMap: envmap,
		envMapIntensity: 0.135,
		flatShading: true,
		map
	});

	let mesh = new Mesh(geo, mat);
	mesh.name = "Hex-Mesh";
	mesh.castShadow = true;
	mesh.recieveShadow = true;

	return mesh;
}

function stone(height, position) {
	const px = Math.random() * 0.4;
	const pz = Math.random() * 0.4;

	const geo = new SphereGeometry(Math.random() * 0.3 + 0.1, 7, 7);
	geo.translate(position.x + px, height, position.y + pz);

	return geo;
}

function tree(height, position) {
	const treeHeight = Math.random() * 1 + 1.25;

	const geo = new CylinderGeometry(0.2, 0.2, treeHeight, 30);
	geo.translate(position.x, height + treeHeight * 0 + 1, position.y);
	
	const geo2 = new CylinderGeometry(0, 1.5, treeHeight, 3);
	geo2.translate(position.x, height + treeHeight * 0.6 + 1, position.y);
	
	const geo3 = new CylinderGeometry(0, 1.15, treeHeight, 3);
	geo3.translate(position.x, height + treeHeight * 1.25 + 1, position.y);

	const geo4 = new CylinderGeometry(0, 0.8, treeHeight, 3);
	geo4.translate(position.x, height + treeHeight * 1.9 + 1, position.y);

	return mergeBufferGeometries([geo, geo2, geo3, geo4]);
}

function clouds() {
	let geo = new SphereGeometry(0, 0, 0); 
	let count = Math.floor(Math.pow(Math.random(), 0.45) * 4);
	
	for(let i = 0; i < count; i++) {
		const puff1 = new SphereGeometry(1.2, 7, 7);
		const puff2 = new SphereGeometry(1.5, 7, 7);
		const puff3 = new SphereGeometry(0.9, 7, 7);
	   
		puff1.translate(-1.85, Math.random() * 0.3, 0);
		puff2.translate(0,     Math.random() * 0.3, 0);
		puff3.translate(1.85,  Math.random() * 0.3, 0);
	
		const cloudGeo = mergeBufferGeometries([puff1, puff2, puff3]);
		cloudGeo.translate( 
	    	Math.random() * 20 - 10, 
	    	Math.random() * 7 + 7, 
	    	Math.random() * 20 - 10
	    );
	    cloudGeo.rotateY(Math.random() * Math.PI * 2);

		geo = mergeBufferGeometries([geo, cloudGeo]);
	}
	  
	const mesh = new Mesh(
	    geo,
	    new MeshStandardMaterial({
	    	envMap: envmap,
	    	envMapIntensity: 0.75,
	    	flatShading: true,
			transparent: true,
			opacity: 0.65,
		})
	);
	mesh.name = "Cloud-Spherical-Mesh";

  // scene.add(mesh);
	return mesh;
}

function floorObj(textures, envmap) {

	let mapContainer = new Mesh(
		new CylinderGeometry(17.1, 17.1, MAX_HEIGHT * 0.25, 50, 1, true),
		new MeshPhysicalMaterial({
			envMap: envmap,
			map: textures.dirt,
			envMapIntensity: 0.2,
			side: DoubleSide
		})
	);
	mapContainer.receiveShadow = true;
	mapContainer.position.set(new Vector3(0, MAX_HEIGHT * 0.125, 0));
	mapContainer.name = "Map-Container-Hollow-Cylinderical-Mesh";
	scene.add(mapContainer);

	addPhysics(mapContainer, 17.1, MAX_HEIGHT * 0.25 * 0.5, new Vector3(0, MAX_HEIGHT * 0.125, 0), 0, {x: 0.383, y: 0, z: 0.383, w: 0}, 1);


	let mapFloor = new Mesh(
		new CylinderGeometry(
			18.5, 18.5, MAX_HEIGHT * 0.1, 50
		),
		new MeshPhysicalMaterial({
			envMap: envmap,
			map: textures.dirt,
			envMapIntensity: 0.1,
			side: DoubleSide
		})
	);
	mapFloor.receiveShadow = true;
	mapFloor.position.set(0, -MAX_HEIGHT * 0.05, 0);
	mapFloor.name = "MapFloor-Cylinderical-Mesh";
	scene.add(mapFloor);

	let mapFloorQuaternion = {
		x: 0.383,
		y: 0,
		z: 0.383,
		w: 0
	};
	let mapFloorTransform = new Ammo.btTransform();
	mapFloorTransform.setIdentity();
	mapFloorTransform.setOrigin(new Ammo.btVector3(
		0, -MAX_HEIGHT * 0.05, 0
	));
	mapFloorTransform.setRotation(new Ammo.btQuaternion(
		mapFloorQuaternion.x, mapFloorQuaternion.y,
		mapFloorQuaternion.z, mapFloorQuaternion.w
	));
	let mapFloorMotionState = new Ammo.btDefaultMotionState(
		mapFloorTransform
	);
	let mapFloorColShape = new Ammo.btCylinderShape(
		new Ammo.btVector3(
			18.5, MAX_HEIGHT * 0.1, 18.5
		));
	mapFloorColShape.setMargin(0);
	let mapFloorLocalInertia = new Ammo.btVector3(0, 0, 0);
	mapFloorColShape.calculateLocalInertia(
		0, mapFloorLocalInertia
	);

	let mapFloorRBInfo = new Ammo.btRigidBodyConstructionInfo(
		0,
		mapFloorMotionState,
		mapFloorColShape,
		mapFloorLocalInertia
	);
	let mapFloorBody = new Ammo.btRigidBody(mapFloorRBInfo);

	physicsWorld.addRigidBody(mapFloorBody);

	mapFloor.userData.physicsBody = mapFloorBody;
	rigidBody_List.push(mapFloor);
	// addPhysics(mapFloor, 18.5, MAX_HEIGHT * 0.1, new Vector3(0, MAX_HEIGHT * 0.05, 0), 0, {x: 0.383, y: 0, z: 0.383, w: 0}, 1);
}

function createPlayer(gltfModel) {
	const playerLoader = new GLTFLoader();
	playerLoader.load(gltfModel, function(gltf){
		PlaneMesh = gltf.scene;
		PlaneMesh.scale.set(0.0025, 0.0025, 0.0025);
		PlaneMesh.rotation.y = Math.PI;
		PlaneMesh.position.y += 15;
		scene.add(PlaneMesh);
		camera.lookAt(
			PlaneMesh.position.x,
			PlaneMesh.position.y,
			PlaneMesh.position.z
		);
	});

	document.onkeydown = function (e) {
		if (e.keyCode === 37) { // Left Arrow Key
			PlaneMesh.position.x -= 0.2; // Go Left
			PlaneMesh.rotation.set(0, Math.PI * 1.5, 0);
		}
		else if (e.keyCode === 39) { // Right Arrow Key
			PlaneMesh.position.x += 0.2; /// Go Right
			PlaneMesh.rotation.set(0, -(Math.PI * 1.5), 0);
		}
		else if (e.keyCode === 38) { // Up Arrow Key
			PlaneMesh.position.z -= 0.2; /// Go Forward
			PlaneMesh.rotation.set(0, Math.PI, 0);
		}
		else if (e.keyCode === 40) { // Down Arrow Key
			PlaneMesh.position.z += 0.2; /// Go Backward
			PlaneMesh.rotation.set(0, 0, 0);
		}
		else if (e.keyCode === 32) { // Spacebar Key
			PlaneMesh.position.y += 0.5; /// Go Upwards
			// PlaneMesh.rotation.x = Math.PI / 4;
			PlaneMesh.rotation.set(Math.PI / 4, Math.PI, 0);
		}
		else if (e.keyCode === 8) { // BackSpace Key
			PlaneMesh.position.y -= 0.2; /// Go Downwards
			// PlaneMesh.rotation.x = -Math.PI / 4;
			PlaneMesh.rotation.set(-Math.PI / 4, Math.PI, 0);
		}
	};
}

function addEventhandlers() {
	window.addEventListener('resize', onWindowResize, false);
};

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	console.log("Window Resized")
};

function updatePhysicsWorld(deltaTime) {
	physicsWorld.stepSimulation( deltaTime, 10 );

	for (let i = 0; i < rigidBody_List.length; i++) {
		let Graphics_Obj = rigidBody_List[i];
		let Physics_Obj = Graphics_Obj.userData.physicsBody;

		let motionState = Physics_Obj.getMotionState();

		if (motionState) {
			motionState.getWorldTransform(tmpTransformation);
			let new_pos = tmpTransformation.getOrigin();
			let new_qua = tmpTransformation.getRotation();

			Graphics_Obj.position.set(
				new_pos.x(), new_pos.y(), new_pos.z()
			);
			Graphics_Obj.quaternion.set(
				new_qua.x(), new_qua.y(),
				new_qua.z(), new_qua.w()
			);
		}
	}
};

// Add trunk to the tree [DONE]
// Add rotation animation to water [DONE]
// Create new Group() of all clouds and then rotate the group in animation to animate clouds [DONE]
// Add player character [DONE]
// Add camera movements and arrow key inputs to player [DONE]
// Add collision
// Add some physics
// Add collectable assets [DONE]

// CylinderGeometry(radiusTop : Float, radiusBottom : Float, height : Float, radialSegments : Integer, heightSegments : Integer, openEnded : Boolean, thetaStart : Float, thetaLength : Float)



function createCube(scale, position, mass, color, quaternion) {
	let newCube = new Mesh(
		new BoxBufferGeometry(scale.x, scale.y, scale.z),
		new MeshPhongMaterial({ color: color })
	);
	newCube.name = "Box"
	newCube.position.set(position.x, position.y, position.z);
	scene.add(newCube);

	let transform = new Ammo.btTransform();
	transform.setIdentity();

	transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
	transform.setRotation(new Ammo.btQuaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w));
	let defaultMotionState = new Ammo.btDefaultMotionState( transform );

	let structColShape = new Ammo.btBoxShape(new Ammo.btVector3(scale.x*0.5, scale.y*0.5, scale.z*0.5));
	structColShape.setMargin(0.05);

	let localInertia = new Ammo.btVector3(0, 0, 0);
	structColShape.calculateLocalInertia(mass, localInertia);

	let rbInfo = new Ammo.btRigidBodyConstructionInfo(
		mass,
		defaultMotionState,
		structColShape,
		localInertia
	);
	let rBody = new Ammo.btRigidBody( rbInfo );

	physicsWorld.addRigidBody( rBody );
	
	newCube.userData.physicsBody = rBody;
	rigidBody_List.push(newCube);
}

function createDropCubes() {
	createCube(
		new Vector3(4, 2, 4),
		new Vector3(14, 100, 0),
		100,
		0xfc09a6,
		{x: 0, y: 0, z: 0, w: 1});
	console.log("createDropCubes() executed");
};

function createCylinder(radius, height, position, mass, color, quaternion, factor) {
	let newCylinder = new Mesh(
		new CylinderGeometry(radius, radius, height, 6),
		new MeshPhongMaterial({ color: color, flatShading: true })
	);
	newCylinder.position.set(position.x, position.y, position.z);+
	scene.add(newCylinder);

	addPhysics(newCylinder, radius, height, position, mass, quaternion, (Math.sqrt(3)/2));
};

function addPhysics(obj, radius, height, position, mass, quaternion, factor) {
	let transform = new Ammo.btTransform();
	transform.setIdentity();

	transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
	transform.setRotation(new Ammo.btQuaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w));
	let motionState = new Ammo.btDefaultMotionState( transform );

	let colShape = new Ammo.btCylinderShape(new Ammo.btVector3(radius*factor, height*0.5, radius*factor));
	colShape.setMargin(0.05);

	let localInertia = new Ammo.btVector3(0, 0, 0);
	colShape.calculateLocalInertia(mass, localInertia);

	let rbInfo = new Ammo.btRigidBodyConstructionInfo(
		mass,
		motionState,
		colShape,
		localInertia
	);
	let body = new Ammo.btRigidBody( rbInfo );

	physicsWorld.addRigidBody( body );
	
	obj.userData.physicsBody = body;
	rigidBody_List.push(obj);
}

function createHex() {
	createCylinder(
		5,
		5,
		new Vector3(0, 25, 0),
		100,
		0xff97ff,
		{x: 0, y: 0, z: 0, w: 1});
	console.log("createHex() executed");
};