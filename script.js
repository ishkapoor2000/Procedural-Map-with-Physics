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
	AmbientLight,
	MeshPhongMaterial,
	BoxBufferGeometry,
} from "https://cdn.skypack.dev/three@0.137";
import { RGBELoader } from "https://cdn.skypack.dev/three-stdlib@2.8.5/loaders/RGBELoader";
import { OrbitControls } from "https://cdn.skypack.dev/three-stdlib@2.8.5/controls/OrbitControls";
import { mergeBufferGeometries } from "https://cdn.skypack.dev/three-stdlib@2.8.5/utils/BufferGeometryUtils";
import SimplexNoise from "https://cdn.skypack.dev/simplex-noise";
import { GLTFLoader } from "https://cdn.skypack.dev/three-stdlib@2.8.5/loaders/GLTFLoader";
import { DRACOLoader } from "https://cdn.skypack.dev/three-stdlib@2.8.5/loaders/DRACOLoader";

let physicsWorld;
let rigidBody_List = new Array();
let noise;
let tmpTransformation = undefined;
let playerPosition = {x:0, y:20, z:0};

let clock, scene, camera, renderer, controls;

let playerObject = null,
	playerMoveDirection = {
		left: 0, right: 0, forward: 0, back: 0, up: 0
	}
const STATE = { DISABLE_DEACTIVATION : 4 }
	
Ammo().then(start)

function start() {
	tmpTransformation = new Ammo.btTransform();
	initPhysicsWorld();
	initGraphicsWorld();

	addEventhandlers();

	console.log("Script started!");
};

function initPhysicsWorld() {
	let collisionConfiguration = new Ammo.btDefaultCollisionConfiguration(),
		dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration),
		overlappingPairCache = new Ammo.btDbvtBroadphase(),
		solver = new Ammo.btSequentialImpulseConstraintSolver();

	physicsWorld = new Ammo.btDiscreteDynamicsWorld(
		dispatcher,
		overlappingPairCache,
		solver,
		collisionConfiguration
	);
	physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));

	console.log("Physics-World initialized.");
};

function initGraphicsWorld() {
	clock = new Clock();

	scene = new Scene();
	scene.background = new Color("#FFEECC");

	camera = new PerspectiveCamera(
		45,
		innerWidth / innerHeight,
		0.1, 1000
	);
	camera.position.set(-17, 36, 33);
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

	const light = new PointLight(
		new Color("#FFCB8E").convertSRGBToLinear().convertSRGBToLinear(),
		80, 200
	);
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
			dirt: await new TextureLoader().loadAsync(
				"texture_assets/dirt.png"),
			dirt2: await new TextureLoader().loadAsync(
				"texture_assets/dirt2.jpg"),
			grass: await new TextureLoader().loadAsync(
				"texture_assets/grass.jpg"),
			sand: await new TextureLoader().loadAsync(
				"texture_assets/sand.jpg"),
			stone: await new TextureLoader().loadAsync(
				"texture_assets/stone.png"),
			water: await new TextureLoader().loadAsync(
				"texture_assets/water.jpg"),
		};
	
		let simplex = new SimplexNoise();
	
		for (let i = -15; i <= 15; i++) {
			for (let j = -15; j <= 15; j++) {
				let position = tileToPosition(i, j);

				if (position.length() > 16) continue;

				noise = (simplex.noise2D(
					i * 0.1, j * 0.1) + 1
				) * 0.5;
				noise = Math.pow(noise, 1.5);

				makeHex(noise * MAX_HEIGHT, position);

				createCylinder(
					1, MAX_HEIGHT * noise * 1,
					new Vector3(
						position.x,
						MAX_HEIGHT * noise * 0.5,
						position.y),
					0, 0xffffff,
					{x: 0, y: 0, z: 0, w: 1});
			}
		}

		let stoneMesh = hexMesh(stoneGeo, textures.stone);
		let grassMesh = hexMesh(grassGeo, textures.grass);
		let dirt2Mesh = hexMesh(dirt2Geo, textures.dirt2);
		let dirtMesh = hexMesh(dirtGeo, textures.dirt);
		let sandMesh = hexMesh(sandGeo, textures.sand);
		stoneMesh.name = "Stone-Mesh";
		grassMesh.name = "Grass-Mesh";
		dirt2Mesh.name = "Dirt2-Mesh";
		dirtMesh.name = "Dirt-Mesh";
		sandMesh.name = "Sand-Mesh";
		scene.add(
			stoneMesh, grassMesh,
			dirt2Mesh, dirtMesh, sandMesh
		);

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
		seaMesh.position.set(0, (MAX_HEIGHT * 0.1) + 0.1, 0);
		seaMesh.name = "Sea-Cylinderical-Mesh";
		scene.add(seaMesh);

		floorObj(textures, envmap);

		let cloudGroup = clouds();
		scene.add(cloudGroup);
		cloudGroup.position.y += 10;
	
		createPlayer("Plane.glb");
	
		renderer.setAnimationLoop(() => {
			controls.update();
			let deltaTime = clock.getDelta();
			movePlayer();
			if (playerObject) {
				if (playerObject.position.y>45) {
					playerMoveDirection.up = -0.5
				}
				if (playerObject.position.y<-45) {
					playerMoveDirection.up = 0
					playerObject.position.set(0, 10, 0)
				}
			}
			updatePhysicsWorld(deltaTime);
			renderer.render(scene, camera);
			seaMesh.rotation.y -= 0.0015;
			cloudGroup.rotation.y += 0.003;
		});
	console.log("Async function being executed.");
	})();

	console.log("Graphics-World initialized.");
};

let envmap, PlaneMesh;
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
	let geo = new CylinderGeometry(
		1, 1,
		height,
		6, 1,
		false
	);
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
	}
	else if (height > GRASS_HEIGHT) {
		grassGeo = mergeBufferGeometries([geo, grassGeo]);

		if (Math.random() > 0.8) {
			grassGeo = mergeBufferGeometries([grassGeo, tree(height, position)]);
		}
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
	mesh.castShadow = true;
	mesh.recieveShadow = true;

	return mesh;
}

function stone(height, position) {
	const px = Math.random() * 0.4;
	const pz = Math.random() * 0.4;

	const geo = new SphereGeometry(
		Math.random() * 0.3 + 0.1, 7, 7);
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
	let count = Math.floor(
		Math.pow(Math.random(), 0.45) * 4
	);
	
	for(let i = 0; i < count; i++) {
		const puff1 = new SphereGeometry(1.2, 7, 7);
		const puff2 = new SphereGeometry(1.5, 7, 7);
		const puff3 = new SphereGeometry(0.9, 7, 7);

		puff1.translate(-1.85, Math.random() * 0.3, 0);
		puff2.translate(0,     Math.random() * 0.3, 0);
		puff3.translate(1.85,  Math.random() * 0.3, 0);

		const cloudGeo = mergeBufferGeometries(
			[puff1, puff2, puff3]
		);
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

	return mesh;
}

function floorObj(textures, envmap) {

	let mapContainer = new Mesh(
		new CylinderGeometry(
			17.1, 17.1,
			MAX_HEIGHT * 0.25,
			50, 1, true),
		new MeshPhysicalMaterial({
			envMap: envmap,
			map: textures.dirt,
			envMapIntensity: 0.2,
			side: DoubleSide
		})
	);
	mapContainer.receiveShadow = true;
	mapContainer.position.set(new Vector3(
		0, MAX_HEIGHT * 0.125, 0
	));
	mapContainer.name = "Map-Container-Hollow-Cylinderical-Mesh";
	scene.add(mapContainer);

	let mapContainerPhyObj = addPhysics(
		17.1, MAX_HEIGHT * 0.25 * 0.5,
		new Vector3(0, MAX_HEIGHT * 0.125, 0),
		0, {x: 0.383, y: 0, z: 0.383, w: 0}, 1);
	physicsWorld.addRigidBody(mapContainerPhyObj);
	mapContainer.userData.physicsBody = mapContainerPhyObj;
	rigidBody_List.push(mapContainer);
	
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

	let mapFloorPhyObj = addPhysics(
		18.5, MAX_HEIGHT * 0.1,
		new Vector3(0, MAX_HEIGHT * 0.05, 0),
		0, {x: 0.383, y: 0, z: 0.383, w: 0}, 1);
	physicsWorld.addRigidBody(mapFloorPhyObj);
	mapFloor.userData.physicsBody = mapFloorPhyObj;
	rigidBody_List.push(mapFloor);
}

function createPlayer(gltfModel) {
	const playerLoader = new GLTFLoader();
	const playerDracoLoader = new DRACOLoader();
	playerDracoLoader.setDecoderPath("/draco/");
	playerLoader.setDRACOLoader(playerDracoLoader);

	playerLoader.load(gltfModel, function(gltf){
		PlaneMesh = playerObject = gltf.scene;
		PlaneMesh.scale.set(0.0025, 0.0025, 0.0025);
		// PlaneMesh.rotation.y = Math.PI;
		scene.add(PlaneMesh);

		let playerMass = 1;
		let playerQuaternion = {x:0, y:0, z:0, w:1};
		let playerTransform = new Ammo.btTransform();
		playerTransform.setIdentity();
		playerTransform.setOrigin(new Ammo.btVector3(
			playerPosition.x,
			playerPosition.y,
			playerPosition.z
		));
		playerTransform.setRotation(new Ammo.btQuaternion(
			playerQuaternion.x,
			playerQuaternion.y,
			playerQuaternion.z,
			playerQuaternion.w
		));

		let playerMotionState = new Ammo.btDefaultMotionState(playerTransform);

		let playerLocalInertia = new Ammo.btVector3(0, 0, 0);

		let structColShape = new Ammo.btBoxShape(
			new Ammo.btVector3(
				PlaneMesh.scale.x*320,
				PlaneMesh.scale.y*100,
				PlaneMesh.scale.z*320
			));
		structColShape.setMargin(0.05);

		structColShape.calculateLocalInertia(
			playerMass, playerLocalInertia
		);

		let rbInfo = new Ammo.btRigidBodyConstructionInfo(
			playerMass,
			playerMotionState,
			structColShape,
			playerLocalInertia
		);

		let rBody = new Ammo.btRigidBody( rbInfo );
		// rBody.setLinearVelocity( new Ammo.btVector3(
		// 		playerPosition.x,
		// 		playerPosition.y,
		// 		playerPosition.z
		// 	));
		// rBody.needUpdate = true;

		rBody.setFriction(4);
		rBody.setRollingFriction(10);
		rBody.setActivationState(STATE.DISABLE_DEACTIVATION);
		
		physicsWorld.addRigidBody( rBody );

		PlaneMesh.userData.physicsBody = rBody;
		rigidBody_List.push(PlaneMesh);

	{// 	let playerVerticesPos = PlaneMesh.children[0].geometry.getAttribute('position').array;
	// 	let triangles = [];

	// 	for (let i = 0; i < playerVerticesPos.length; i +=3 ){
	// 		triangles.push({
	// 			x: playerVerticesPos[i],
	// 			y: playerVerticesPos[i + 1],
	// 			z: playerVerticesPos[i + 2],
	// 		})
	// 	}

	// 	let triangle,
	// 		triangle_mesh = new Ammo.btTriangleMesh();
	// 	let vecA = new Ammo.btVector3(0, 0, 0);
	// 	let vecB = new Ammo.btVector3(0, 0, 0);
	// 	let vecC = new Ammo.btVector3(0, 0, 0);

	// 	for (let i = 0; i < triangles.length - 3; i += 3) {
	// 		vecA.setX(triangles[i].x);
	// 		vecA.setY(triangles[i].y);
	// 		vecA.setZ(triangles[i].z);

	// 		vecB.setX(triangles[i + 1].x);
	// 		vecB.setY(triangles[i + 1].y);
	// 		vecB.setZ(triangles[i + 1].z);

	// 		vecC.setX(triangles[i + 2].x);
	// 		vecC.setY(triangles[i + 2].y);
	// 		vecC.setZ(triangles[i + 2].z);

	// 		triangle_mesh.addTriangle(vecA, vecB, vecC, true);
	// 	}

	// 	Ammo.destroy(vecA);
	// 	Ammo.destroy(vecB);
	// 	Ammo.destroy(vecC);

	// 	const playerShape = new Ammo.btConvexTriangleMeshShape(triangle_mesh, true);
	// 	PlaneMesh.children[0].geometry.verticesNeedUpdate = true;
	// 	playerShape.getMargin(0.05);

	// 	playerShape.calculateLocalInertia(
	// 		playerMass, playerLocalInertia);

	// 	let rbInfo = new Ammo.btRigidBodyConstructionInfo(
	// 		playerMass,
	// 		playerMotionState,
	// 		playerShape,
	// 		playerLocalInertia
	// 	);
	// 	let rBody = new Ammo.btRigidBody( rbInfo );

	// 	physicsWorld.addRigidBody( rBody );

	// 	PlaneMesh.userData.physicsBody = rBody;
	// 	rigidBody_List.push(PlaneMesh);
	}

	});
}

function movePlayer(){

    let scalingFactor = 20;

    let moveX = playerMoveDirection.right
		- playerMoveDirection.left;
    let moveZ = playerMoveDirection.back
		- playerMoveDirection.forward;
    let moveY = playerMoveDirection.up;

    if (moveX == 0 && moveY == 0 && moveZ == 0) return;

    let resultantImpulse = new Ammo.btVector3(
		moveX,
		moveY,
		moveZ
	)
    resultantImpulse.op_mul(scalingFactor);

    let physicsBody = playerObject.userData.physicsBody;
    physicsBody.setLinearVelocity(resultantImpulse);

}

function addEventhandlers() {
	window.addEventListener('resize', onWindowResize, false);
	window.addEventListener('keydown', handleKeyDown, false);
    window.addEventListener('keyup', handleKeyUp, false);
};

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	console.log("Window Resized")
};

function handleKeyDown(event){

    let keyCode = event.keyCode;

    switch(keyCode){

        case 87: //W: FORWARD
            playerMoveDirection.forward = 1
			playerMoveDirection.up = -1
            break;

        case 83: //S: BACK
			playerMoveDirection.back = 1
			playerMoveDirection.up = -1
            break;

        case 65: //A: LEFT
			playerMoveDirection.left = 1
            playerMoveDirection.up = -1
            break;

        case 68: //D: RIGHT
            playerMoveDirection.right = 1
			playerMoveDirection.up = -1
            break;

		case 32: //SPACE: UP
            playerMoveDirection.up = 1
			playerMoveDirection.forward = 0
			playerMoveDirection.back = 0
			playerMoveDirection.left = 0
			playerMoveDirection.right = 0
            break;

    }
}

function handleKeyUp(event){
    let keyCode = event.keyCode;

    switch(keyCode){
        case 87: //FORWARD
            playerMoveDirection.forward = 0
            break;

        case 83: //BACK
            playerMoveDirection.back = 0
            break;

        case 65: //LEFT
            playerMoveDirection.left = 0
            break;

        case 68: //RIGHT
            playerMoveDirection.right = 0
            break;

		case 32: //UP
            playerMoveDirection.up = -0.5
            break;

    }

}

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

function addPhysics(radius, height, position, mass, quaternion, factor) {
	let transform = new Ammo.btTransform();
	transform.setIdentity();
	transform.setOrigin(new Ammo.btVector3(
		position.x,
		position.y,
		position.z
	));
	transform.setRotation(new Ammo.btQuaternion(
		quaternion.x,
		quaternion.y,
		quaternion.z,
		quaternion.w
	));

	let motionState = new Ammo.btDefaultMotionState(
		transform
	);

	let colShape = new Ammo.btCylinderShape(
		new Ammo.btVector3(
			radius * factor,
			height * 0.5,
			radius * factor
	));
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
	body.setFriction(4);
	body.setRollingFriction(10);
	body.setCollisionFlags( 2 );

	// physicsWorld.addRigidBody( body );
	// obj.userData.physicsBody = body;
	// rigidBody_List.push(obj);
	console.log("addPhysics(); execeuted");
	return body;
}

function createCylinder(radius, height, position, mass, color, quaternion) {
	let newCylinder = new Mesh(
		new CylinderGeometry(radius, radius, height, 6),
		new MeshPhongMaterial({
			color: color, flatShading: true
		})
	);
	newCylinder.position.set(
		position.x,
		position.y,
		position.z
	);
	scene.add(newCylinder);
	newCylinder.name = `Physics-Mesh-${
		Math.floor(position.x)*-1}-${
		Math.floor(position.z)*-1}`;
	newCylinder.scale.set(0.99, 0.99, 0.99);

	let transform = new Ammo.btTransform();
	transform.setIdentity();
	transform.setOrigin(new Ammo.btVector3(
		position.x,
		position.y,
		position.z
	));
	transform.setRotation(new Ammo.btQuaternion(
		quaternion.x,
		quaternion.y,
		quaternion.z,
		quaternion.w
	));

	let motionState = new Ammo.btDefaultMotionState(
		transform
	);

	let colShape = new Ammo.btCylinderShape(
		new Ammo.btVector3(
			radius * (Math.sqrt(3) / 2),
			height * 0.5,
			radius * (Math.sqrt(3) / 2)
	));
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

	// let phyObj = addPhysics(radius, height, position, mass, quaternion, (Math.sqrt(3)/2));
	physicsWorld.addRigidBody( body );
	newCylinder.userData.physicsBody = body;
	rigidBody_List.push(newCylinder);
};

// Add trunk to the tree [DONE]
// Add rotation animation to water [DONE]
// Create new Group() of all clouds and then rotate the group in animation to animate clouds [DONE]
// Add player character [DONE]
// Add camera movements and arrow key inputs to player [DONE]
// Add collectable assets [DONE]
// Add collision [DONE]
// Add some physics [DONE]