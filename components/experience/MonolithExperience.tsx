"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const TOWER_CENTERS = [-35, 35] as const;
const TOWER_SIZE = 44;
const TOWER_HALF = TOWER_SIZE / 2;
const FLOOR_HEIGHT = 8;
const FLOOR_HEIGHTS = [52, 60, 68, 76, 84] as const;
const BRIDGE_Y = FLOOR_HEIGHTS[2];
const EYE_HEIGHT = 1.7;
const FRAME_COUNT = 1000;
const STAIR_X_OFFSETS = [-8, 8, -8, 8] as const;
const OWNER_CHARACTER_PLACEMENTS = [
  { x: -11.15, z: 4.25, rotationY: Math.PI / 2, phase: 0 },
  { x: 11.15, z: -4.25, rotationY: -Math.PI / 2, phase: Math.PI * 0.62 },
] as const;

type FrameRecord = {
  id: number;
  tower: "A" | "B";
  floor: number;
  slot: number;
};

type LocationState = {
  eyebrow: string;
  title: string;
};

type WorldHandles = {
  frames: THREE.InstancedMesh;
  highlight: THREE.Mesh;
  ownerCharacters: OwnerCharacterHandle[];
};

type OwnerCharacterHandle = {
  wavingArm: THREE.Group;
  restingArmRotation: number;
  phase: number;
};

type GallerySlot = {
  position: THREE.Vector3;
  rotationY: number;
  normal: THREE.Vector3;
};

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  rotationY = 0,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addRailBetween(
  parent: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const direction = end.clone().sub(start);
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 10),
    material,
  );
  rail.position.copy(start).add(end).multiplyScalar(0.5);
  rail.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  rail.castShadow = true;
  rail.receiveShadow = true;
  parent.add(rail);
  return rail;
}

function addCharacterMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createOwnerCharacter(
  scene: THREE.Scene,
  position: THREE.Vector3,
  rotationY: number,
  phase: number,
): OwnerCharacterHandle {
  const character = new THREE.Group();
  character.position.copy(position);
  character.rotation.y = rotationY;
  character.scale.setScalar(0.92);

  const hoodieMaterial = new THREE.MeshStandardMaterial({
    color: 0x30255f,
    roughness: 0.83,
    metalness: 0.02,
  });
  const hoodieHighlightMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3a86,
    roughness: 0.8,
    metalness: 0.02,
  });
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xf3c8ad,
    roughness: 0.8,
    metalness: 0,
  });
  const hairMaterial = new THREE.MeshStandardMaterial({
    color: 0x713b3e,
    roughness: 0.72,
    metalness: 0.01,
  });
  const pantsMaterial = new THREE.MeshStandardMaterial({
    color: 0x24262c,
    roughness: 0.91,
    metalness: 0,
  });
  const shoePurpleMaterial = new THREE.MeshStandardMaterial({
    color: 0x58428c,
    roughness: 0.68,
    metalness: 0.03,
  });
  const shoeWhiteMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8e3dc,
    roughness: 0.74,
    metalness: 0,
  });
  const facialMaterial = new THREE.MeshStandardMaterial({
    color: 0x33201f,
    roughness: 0.76,
    metalness: 0,
  });
  const blushMaterial = new THREE.MeshStandardMaterial({
    color: 0xe78f91,
    roughness: 0.8,
    metalness: 0,
  });

  // Shoes and legs keep the approved compact, full-body chibi silhouette.
  for (const side of [-1, 1]) {
    addCharacterMesh(
      character,
      new THREE.CapsuleGeometry(0.18, 0.34, 5, 10),
      shoeWhiteMaterial,
      [side * 0.27, 0.18, 0.12],
      [1.05, 1, 1.15],
      [Math.PI / 2, 0, 0],
    );
    addCharacterMesh(
      character,
      new THREE.BoxGeometry(0.38, 0.12, 0.42),
      shoePurpleMaterial,
      [side * 0.27, 0.15, 0.26],
    );
    addCharacterMesh(
      character,
      new THREE.CapsuleGeometry(0.24, 0.58, 6, 12),
      pantsMaterial,
      [side * 0.27, 0.72, 0],
      [1.04, 1, 1.02],
    );
  }

  addCharacterMesh(
    character,
    new THREE.SphereGeometry(0.72, 26, 18),
    hoodieMaterial,
    [0, 1.58, 0],
    [1, 1.02, 0.72],
  );
  addCharacterMesh(
    character,
    new THREE.TorusGeometry(0.57, 0.065, 8, 30),
    hoodieHighlightMaterial,
    [0, 1.09, 0],
    [1, 0.76, 1],
    [Math.PI / 2, 0, 0],
  );
  addCharacterMesh(
    character,
    new THREE.BoxGeometry(0.58, 0.27, 0.06),
    hoodieHighlightMaterial,
    [0, 1.43, 0.54],
  );
  for (const side of [-1, 1]) {
    addCharacterMesh(
      character,
      new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8),
      hoodieHighlightMaterial,
      [side * 0.14, 1.76, 0.58],
    );
  }

  // Hood, face, hair and closed-eye expression mirror the approved concept.
  addCharacterMesh(
    character,
    new THREE.SphereGeometry(0.79, 30, 22),
    hoodieMaterial,
    [0, 2.56, 0],
    [1, 1.03, 0.82],
  );
  addCharacterMesh(
    character,
    new THREE.SphereGeometry(0.61, 30, 22),
    skinMaterial,
    [0, 2.53, 0.48],
    [1, 0.9, 0.78],
  );
  addCharacterMesh(
    character,
    new THREE.TorusGeometry(0.63, 0.12, 10, 40),
    hoodieHighlightMaterial,
    [0, 2.57, 0.72],
    [1, 1.03, 1],
  );
  addCharacterMesh(
    character,
    new THREE.SphereGeometry(0.62, 28, 18),
    hairMaterial,
    [0, 2.87, 0.63],
    [1, 0.5, 0.78],
  );
  [
    { x: -0.3, y: 2.76, rz: -0.28, sx: 1.15 },
    { x: 0, y: 2.8, rz: -0.08, sx: 1.2 },
    { x: 0.3, y: 2.78, rz: 0.22, sx: 1.05 },
  ].forEach(({ x, y, rz, sx }) => {
    addCharacterMesh(
      character,
      new THREE.SphereGeometry(0.22, 18, 12),
      hairMaterial,
      [x, y, 1.02],
      [sx, 0.42, 0.35],
      [0, 0, rz],
    );
  });

  for (const side of [-1, 1]) {
    addCharacterMesh(
      character,
      new THREE.BoxGeometry(0.22, 0.026, 0.025),
      facialMaterial,
      [side * 0.23, 2.5, 0.97],
      [1, 1, 1],
      [0, 0, side * 0.06],
    );
    addCharacterMesh(
      character,
      new THREE.SphereGeometry(0.035, 10, 8),
      blushMaterial,
      [side * 0.32, 2.38, 0.96],
      [1.8, 0.55, 0.35],
    );
  }
  addCharacterMesh(
    character,
    new THREE.SphereGeometry(0.026, 10, 8),
    facialMaterial,
    [0, 2.31, 0.97],
    [1.3, 0.55, 0.45],
  );

  const restingArm = new THREE.Group();
  restingArm.position.set(-0.61, 1.88, 0.04);
  restingArm.rotation.z = 0.08;
  addCharacterMesh(
    restingArm,
    new THREE.CapsuleGeometry(0.19, 0.48, 6, 12),
    hoodieMaterial,
    [0, -0.38, 0],
  );
  addCharacterMesh(
    restingArm,
    new THREE.SphereGeometry(0.16, 16, 12),
    skinMaterial,
    [0, -0.79, 0.01],
  );
  character.add(restingArm);

  const wavingArm = new THREE.Group();
  const restingArmRotation = -0.37;
  wavingArm.position.set(0.61, 1.9, 0.04);
  wavingArm.rotation.z = restingArmRotation;
  addCharacterMesh(
    wavingArm,
    new THREE.CapsuleGeometry(0.2, 0.42, 6, 12),
    hoodieMaterial,
    [0, 0.32, 0],
  );
  addCharacterMesh(
    wavingArm,
    new THREE.SphereGeometry(0.17, 16, 12),
    skinMaterial,
    [0, 0.72, 0.01],
  );
  for (const finger of [-1, 1]) {
    addCharacterMesh(
      wavingArm,
      new THREE.CapsuleGeometry(0.052, 0.2, 5, 10),
      skinMaterial,
      [finger * 0.075, 0.98, 0.01],
      [1, 1, 1],
      [0, 0, finger * 0.14],
    );
  }
  addCharacterMesh(
    wavingArm,
    new THREE.CapsuleGeometry(0.045, 0.11, 5, 9),
    skinMaterial,
    [-0.13, 0.76, 0.04],
    [1, 1, 1],
    [0, 0, Math.PI / 2.7],
  );
  character.add(wavingArm);

  scene.add(character);
  return { wavingArm, restingArmRotation, phase };
}

function createClouds(scene: THREE.Scene) {
  const random = seededRandom(603);
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  for (let cloudIndex = 0; cloudIndex < 22; cloudIndex += 1) {
    const cloud = new THREE.Group();
    const angle = random() * Math.PI * 2;
    const radius = 230 + random() * 280;
    cloud.position.set(
      Math.cos(angle) * radius,
      95 + random() * 115,
      Math.sin(angle) * radius,
    );

    const puffCount = 3 + Math.floor(random() * 4);
    for (let puffIndex = 0; puffIndex < puffCount; puffIndex += 1) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(8 + random() * 15, 12, 8),
        material,
      );
      puff.position.set((puffIndex - puffCount / 2) * 13, random() * 7, 0);
      puff.scale.y = 0.55 + random() * 0.25;
      cloud.add(puff);
    }
    scene.add(cloud);
  }
}

function createCity(scene: THREE.Scene) {
  const random = seededRandom(1908);
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b8a82,
    roughness: 0.93,
    metalness: 0.03,
  });
  const buildings = new THREE.InstancedMesh(
    buildingGeometry,
    buildingMaterial,
    150,
  );
  const transform = new THREE.Object3D();
  const color = new THREE.Color();

  let placed = 0;
  while (placed < 150) {
    const angle = random() * Math.PI * 2;
    const radius = 85 + random() * 330;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 85 && Math.abs(z) < 65) continue;

    const width = 9 + random() * 22;
    const depth = 9 + random() * 22;
    const distanceFactor = Math.max(0.35, 1 - radius / 520);
    const height = 18 + random() * 92 * distanceFactor;
    transform.position.set(x, height / 2, z);
    transform.scale.set(width, height, depth);
    transform.rotation.y = Math.round(random() * 3) * (Math.PI / 2);
    transform.updateMatrix();
    buildings.setMatrixAt(placed, transform.matrix);
    color.setHSL(0.1, 0.045, 0.38 + random() * 0.17);
    buildings.setColorAt(placed, color);
    placed += 1;
  }
  buildings.receiveShadow = true;
  buildings.castShadow = true;
  buildings.instanceMatrix.needsUpdate = true;
  if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
  scene.add(buildings);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshStandardMaterial({ color: 0x6f7777, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const plazaMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a8982,
    roughness: 0.96,
  });
  addBox(scene, [145, 0.7, 108], [0, 0.35, 0], plazaMaterial);

  const roadMaterial = new THREE.MeshStandardMaterial({
    color: 0x343a3b,
    roughness: 1,
  });
  addBox(scene, [720, 0.15, 14], [0, 0.55, -65], roadMaterial);
  addBox(scene, [14, 0.15, 720], [-86, 0.55, 0], roadMaterial);
}

function createFacadeCrown(
  tower: THREE.Group,
  centerX: number,
  concrete: THREE.Material,
  darkMetal: THREE.Material,
) {
  addBox(tower, [39, 9, 40], [centerX, 124.5, 0], darkMetal);
  const towardCenter = centerX < 0 ? 1 : -1;
  const crownLevels = [
    { y: 135, h: 18, w: 42, d: 42, shift: 0 },
    { y: 153, h: 18, w: 38, d: 40, shift: 1.2 },
    { y: 172, h: 20, w: 34, d: 38, shift: 2.4 },
    { y: 193, h: 22, w: 31, d: 36, shift: 3.7 },
    { y: 213, h: 18, w: 28, d: 34, shift: 4.8 },
  ];

  crownLevels.forEach(({ y, h, w, d, shift }, index) => {
    const x = centerX + towardCenter * shift;
    addBox(tower, [w, h, d], [x, y, 0], concrete);
    for (let groove = -1; groove <= 1; groove += 1) {
      addBox(
        tower,
        [0.35, h * 0.85, d + 0.3],
        [x + groove * (w / 4), y, 0],
        darkMetal,
      );
    }
    if (index < 3) {
      addBox(tower, [w + 1.2, 0.65, d + 1.2], [x, y - h / 2 + 1.1, 0], darkMetal);
    }
  });
}

function createStairs(
  parent: THREE.Object3D,
  centerX: number,
  concrete: THREE.Material,
  darkMetal: THREE.Material,
) {
  for (let floorIndex = 0; floorIndex < 4; floorIndex += 1) {
    const ascendingPositiveZ = floorIndex % 2 === 0;
    const lowerY = FLOOR_HEIGHTS[floorIndex];
    const stairX = centerX + STAIR_X_OFFSETS[floorIndex];
    const stepCount = 20;
    for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
      const t = stepIndex / (stepCount - 1);
      const z = (ascendingPositiveZ ? -13 : 13) +
        (ascendingPositiveZ ? 26 : -26) * t;
      const y = lowerY + t * FLOOR_HEIGHT;
      addBox(parent, [6.2, 0.42, 1.45], [stairX, y + 0.2, z], concrete);
    }

    const startZ = ascendingPositiveZ ? -13 : 13;
    const endZ = ascendingPositiveZ ? 13 : -13;
    for (const side of [-1, 1]) {
      const railX = stairX + side * 3.22;
      addRailBetween(
        parent,
        new THREE.Vector3(railX, lowerY + 1.45, startZ),
        new THREE.Vector3(railX, lowerY + FLOOR_HEIGHT + 1.45, endZ),
        0.09,
        darkMetal,
      );

      for (const postIndex of [0, 4, 8, 12, 16, 19]) {
        const t = postIndex / (stepCount - 1);
        const z = startZ + (endZ - startZ) * t;
        const stairY = lowerY + FLOOR_HEIGHT * t;
        addRailBetween(
          parent,
          new THREE.Vector3(railX, stairY + 0.35, z),
          new THREE.Vector3(railX, stairY + 1.45, z),
          0.055,
          darkMetal,
        );
      }
    }
  }
}

function createFloorSlab(
  tower: THREE.Object3D,
  centerX: number,
  floorY: number,
  floorIndex: number,
  material: THREE.Material,
) {
  const slabSize = TOWER_SIZE - 1.2;

  if (floorIndex === 0) {
    addBox(tower, [slabSize, 0.55, slabSize], [centerX, floorY, 0], material);
    return;
  }

  // Each upper floor opens only above the flight arriving from below. Because
  // consecutive flights alternate left and right, upward and downward routes
  // remain physically separate on every intermediate level.
  const openingWidth = 7.6;
  const openingDepth = 28.8;
  const openingCenterX = centerX + STAIR_X_OFFSETS[floorIndex - 1];
  const slabLeft = centerX - slabSize / 2;
  const slabRight = centerX + slabSize / 2;
  const openingLeft = openingCenterX - openingWidth / 2;
  const openingRight = openingCenterX + openingWidth / 2;
  const leftWidth = openingLeft - slabLeft;
  const rightWidth = slabRight - openingRight;
  const endDepth = (slabSize - openingDepth) / 2;
  const endOffset = openingDepth / 2 + endDepth / 2;

  addBox(
    tower,
    [leftWidth, 0.55, slabSize],
    [slabLeft + leftWidth / 2, floorY, 0],
    material,
  );
  addBox(
    tower,
    [rightWidth, 0.55, slabSize],
    [openingRight + rightWidth / 2, floorY, 0],
    material,
  );
  addBox(
    tower,
    [openingWidth, 0.55, endDepth],
    [openingCenterX, floorY, -endOffset],
    material,
  );
  addBox(
    tower,
    [openingWidth, 0.55, endDepth],
    [openingCenterX, floorY, endOffset],
    material,
  );
}

function createGallerySlots(
  centerX: number,
  floorY: number,
  floorIndex: number,
  towerIndex: number,
) {
  const slots: GallerySlot[] = [];
  const eastX = centerX + TOWER_HALF;
  const westX = centerX - TOWER_HALF;
  const isBridgeFloor = floorIndex === 2;
  const frameInset = 0.62;
  const rowDefinitions = [
    { count: 13, y: floorY + 2.05 },
    { count: 12, y: floorY + 4.55 },
  ];
  const spread = (index: number, count: number, min: number, max: number) =>
    count === 1 ? (min + max) / 2 : min + (index / (count - 1)) * (max - min);

  const addNorthSouthWall = (
    z: number,
    rotationY: number,
    normal: THREE.Vector3,
  ) => {
    rowDefinitions.forEach(({ count, y }) => {
      for (let index = 0; index < count; index += 1) {
        const localX = spread(index, count, -16.6, 16.6);
        slots.push({
          position: new THREE.Vector3(centerX + localX, y, z),
          rotationY,
          normal: normal.clone(),
        });
      }
    });
  };

  const addSideWall = (
    x: number,
    rotationY: number,
    normal: THREE.Vector3,
  ) => {
    rowDefinitions.forEach(({ count, y }) => {
      for (let index = 0; index < count; index += 1) {
        slots.push({
          position: new THREE.Vector3(x, y, spread(index, count, -16.6, 16.6)),
          rotationY,
          normal: normal.clone(),
        });
      }
    });
  };

  addNorthSouthWall(TOWER_HALF - frameInset, 0, new THREE.Vector3(0, 0, -1));
  addNorthSouthWall(-TOWER_HALF + frameInset, Math.PI, new THREE.Vector3(0, 0, 1));

  const eastIsInner = towerIndex === 0;
  if (!isBridgeFloor) {
    addSideWall(eastX - frameInset, -Math.PI / 2, new THREE.Vector3(-1, 0, 0));
    addSideWall(westX + frameInset, Math.PI / 2, new THREE.Vector3(1, 0, 0));
  } else {
    const outerX = eastIsInner ? westX + frameInset : eastX - frameInset;
    const outerRotation = eastIsInner ? Math.PI / 2 : -Math.PI / 2;
    const outerNormal = new THREE.Vector3(eastIsInner ? 1 : -1, 0, 0);
    addSideWall(outerX, outerRotation, outerNormal);

    // The bridge entrance divides the inner wall. Two rows keep every frame
    // clear of both the doorway and the structural corner pillars.
    const innerX = eastIsInner ? eastX - frameInset : westX + frameInset;
    const innerRotation = eastIsInner ? -Math.PI / 2 : Math.PI / 2;
    const innerNormal = new THREE.Vector3(eastIsInner ? -1 : 1, 0, 0);
    const segmentRows = [
      { y: floorY + 2.05, negativeCount: 7, positiveCount: 6 },
      { y: floorY + 4.55, negativeCount: 6, positiveCount: 6 },
    ];

    segmentRows.forEach(({ y, negativeCount, positiveCount }) => {
      for (let index = 0; index < negativeCount; index += 1) {
        slots.push({
          position: new THREE.Vector3(
            innerX,
            y,
            spread(index, negativeCount, -16.6, -7.2),
          ),
          rotationY: innerRotation,
          normal: innerNormal.clone(),
        });
      }
      for (let index = 0; index < positiveCount; index += 1) {
        slots.push({
          position: new THREE.Vector3(
            innerX,
            y,
            spread(index, positiveCount, 7.2, 16.6),
          ),
          rotationY: innerRotation,
          normal: innerNormal.clone(),
        });
      }
    });
  }

  if (slots.length !== 100) {
    throw new Error(`Expected 100 wall-mounted frames, received ${slots.length}`);
  }

  return slots.map((slot) => ({
    ...slot,
    position: slot.position.clone().add(slot.normal.clone().multiplyScalar(0.12)),
  }));
}

function createTower(
  scene: THREE.Scene,
  centerX: number,
  towerIndex: number,
  frameTransforms: THREE.Matrix4[],
  artworkTransforms: THREE.Matrix4[],
  concrete: THREE.Material,
  wallMaterial: THREE.Material,
  floorMaterial: THREE.Material,
  darkMetal: THREE.Material,
) {
  const tower = new THREE.Group();
  addBox(tower, [TOWER_SIZE, 50, TOWER_SIZE], [centerX, 25, 0], concrete);
  addBox(tower, [TOWER_SIZE + 2, 5, TOWER_SIZE + 2], [centerX, 2.5, 0], concrete);
  addBox(tower, [TOWER_SIZE, 26, TOWER_SIZE], [centerX, 105, 0], concrete);

  const pillarOffsets = [
    [-TOWER_HALF + 2, -TOWER_HALF + 2],
    [-TOWER_HALF + 2, TOWER_HALF - 2],
    [TOWER_HALF - 2, -TOWER_HALF + 2],
    [TOWER_HALF - 2, TOWER_HALF - 2],
  ];
  pillarOffsets.forEach(([xOffset, zOffset]) => {
    addBox(tower, [4.2, 72, 4.2], [centerX + xOffset, 86, zOffset], concrete);
  });

  FLOOR_HEIGHTS.forEach((floorY, floorIndex) => {
    createFloorSlab(tower, centerX, floorY, floorIndex, floorMaterial);
    const wallY = floorY + FLOOR_HEIGHT / 2;
    const wallHeight = FLOOR_HEIGHT + 0.25;
    addBox(tower, [TOWER_SIZE, wallHeight, 0.55], [centerX, wallY, TOWER_HALF], wallMaterial);
    addBox(tower, [TOWER_SIZE, wallHeight, 0.55], [centerX, wallY, -TOWER_HALF], wallMaterial);

    const isBridgeFloor = floorIndex === 2;
    const eastX = centerX + TOWER_HALF;
    const westX = centerX - TOWER_HALF;
    if (isBridgeFloor) {
      const outerX = towerIndex === 0 ? westX : eastX;
      const openingX = towerIndex === 0 ? eastX : westX;
      addBox(tower, [0.55, wallHeight, TOWER_SIZE], [outerX, wallY, 0], wallMaterial);
      addBox(tower, [0.55, wallHeight, 16], [openingX, wallY, -14], wallMaterial);
      addBox(tower, [0.55, wallHeight, 16], [openingX, wallY, 14], wallMaterial);
    } else {
      addBox(tower, [0.55, wallHeight, TOWER_SIZE], [eastX, wallY, 0], wallMaterial);
      addBox(tower, [0.55, wallHeight, TOWER_SIZE], [westX, wallY, 0], wallMaterial);
    }

    const slots = createGallerySlots(centerX, floorY, floorIndex, towerIndex);
    slots.forEach((slotData) => {
      const rotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, slotData.rotationY, 0),
      );
      frameTransforms.push(
        new THREE.Matrix4().compose(
          slotData.position,
          rotation,
          new THREE.Vector3(1, 1, 1),
        ),
      );
      artworkTransforms.push(
        new THREE.Matrix4().compose(
          slotData.position.clone().add(slotData.normal.clone().multiplyScalar(0.095)),
          rotation,
          new THREE.Vector3(1, 1, 1),
        ),
      );
    });
  });

  createStairs(tower, centerX, floorMaterial, darkMetal);
  createFacadeCrown(tower, centerX, concrete, darkMetal);
  for (let panel = -2; panel <= 2; panel += 1) {
    addBox(
      tower,
      [0.4, 46, TOWER_SIZE + 0.4],
      [centerX + panel * 8, 25, 0],
      darkMetal,
    );
  }
  scene.add(tower);
}

function createSkybridge(
  scene: THREE.Scene,
  concrete: THREE.Material,
  darkMetal: THREE.Material,
) {
  const bridge = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x9db9c4,
    transparent: true,
    opacity: 0.28,
    roughness: 0.18,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  addBox(bridge, [30, 0.8, 14], [0, BRIDGE_Y, 0], concrete);
  addBox(bridge, [30, 1.35, 0.2], [0, BRIDGE_Y + 1.05, 6.85], glass);
  addBox(bridge, [30, 1.35, 0.2], [0, BRIDGE_Y + 1.05, -6.85], glass);
  addBox(bridge, [30, 0.12, 0.18], [0, BRIDGE_Y + 1.75, 6.85], darkMetal);
  addBox(bridge, [30, 0.12, 0.18], [0, BRIDGE_Y + 1.75, -6.85], darkMetal);
  for (let beam = -3; beam <= 3; beam += 1) {
    addBox(bridge, [0.22, 1.75, 0.28], [beam * 4.6, BRIDGE_Y + 0.9, 6.9], darkMetal);
    addBox(bridge, [0.22, 1.75, 0.28], [beam * 4.6, BRIDGE_Y + 0.9, -6.9], darkMetal);
  }
  scene.add(bridge);
}

function createComingSoonTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1280;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#292d2d");
  gradient.addColorStop(0.52, "#111414");
  gradient.addColorStop(1, "#302f2a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(214, 191, 143, 0.38)";
  context.lineWidth = 5;
  context.strokeRect(70, 70, canvas.width - 140, canvas.height - 140);

  context.textAlign = "center";
  context.fillStyle = "rgba(218, 197, 154, 0.72)";
  context.font = "600 28px Arial, sans-serif";
  context.letterSpacing = "10px";
  context.fillText("MONOLITH ARCHIVE", canvas.width / 2, 230);

  context.fillStyle = "#ead9b4";
  context.font = "700 74px Arial, sans-serif";
  context.letterSpacing = "4px";
  context.fillText("COMING SOON", canvas.width / 2, 665);

  context.fillStyle = "rgba(218, 197, 154, 0.55)";
  context.font = "500 24px Arial, sans-serif";
  context.letterSpacing = "8px";
  context.fillText("NFT COLLECTION", canvas.width / 2, 725);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createParquetTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "#c79a68";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const random = seededRandom(8241);
  const plankHeight = 128;
  const plankWidth = 340;

  for (let row = 0; row < 8; row += 1) {
    const offset = row % 2 === 0 ? 0 : -plankWidth / 2;
    for (let x = offset; x < canvas.width; x += plankWidth) {
      const lightness = 58 + random() * 10;
      context.fillStyle = `hsl(31 42% ${lightness}%)`;
      context.fillRect(x + 2, row * plankHeight + 2, plankWidth - 4, plankHeight - 4);

      context.strokeStyle = "rgba(86, 52, 26, 0.14)";
      context.lineWidth = 2;
      for (let grain = 0; grain < 4; grain += 1) {
        const grainY = row * plankHeight + 22 + grain * 22 + random() * 8;
        context.beginPath();
        context.moveTo(x + 20, grainY);
        context.bezierCurveTo(
          x + plankWidth * 0.34,
          grainY + random() * 10 - 5,
          x + plankWidth * 0.68,
          grainY + random() * 10 - 5,
          x + plankWidth - 20,
          grainY,
        );
        context.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.anisotropy = 4;
  return texture;
}

function createWorld(scene: THREE.Scene): WorldHandles {
  const concrete = new THREE.MeshStandardMaterial({
    color: 0xa49c89,
    roughness: 0.92,
    metalness: 0.02,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4f1e9,
    roughness: 0.86,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const parquetTexture = createParquetTexture();
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff4e6,
    map: parquetTexture,
    roughness: 0.74,
    metalness: 0.01,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x22282a,
    roughness: 0.66,
    metalness: 0.55,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x171a1b,
    roughness: 0.52,
    metalness: 0.62,
  });
  const comingSoonTexture = createComingSoonTexture();
  const artworkMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: comingSoonTexture,
    roughness: 0.84,
    emissive: 0x171713,
    emissiveIntensity: 0.16,
  });

  createCity(scene);
  createClouds(scene);

  const frameTransforms: THREE.Matrix4[] = [];
  const artworkTransforms: THREE.Matrix4[] = [];
  TOWER_CENTERS.forEach((centerX, towerIndex) => {
    createTower(
      scene,
      centerX,
      towerIndex,
      frameTransforms,
      artworkTransforms,
      concrete,
      wallMaterial,
      floorMaterial,
      darkMetal,
    );
  });
  createSkybridge(scene, concrete, darkMetal);

  const ownerCharacters = OWNER_CHARACTER_PLACEMENTS.map(
    ({ x, z, rotationY, phase }) => createOwnerCharacter(
      scene,
      new THREE.Vector3(x, BRIDGE_Y + 0.42, z),
      rotationY,
      phase,
    ),
  );

  const frames = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.42, 1.92, 0.13),
    frameMaterial,
    FRAME_COUNT,
  );
  const artwork = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.14, 1.62, 0.035),
    artworkMaterial,
    FRAME_COUNT,
  );
  frameTransforms.forEach((matrix, index) => frames.setMatrixAt(index, matrix));
  artworkTransforms.forEach((matrix, index) => artwork.setMatrixAt(index, matrix));
  frames.instanceMatrix.needsUpdate = true;
  artwork.instanceMatrix.needsUpdate = true;
  frames.castShadow = true;
  artwork.receiveShadow = true;
  scene.add(frames, artwork);

  const highlight = new THREE.Mesh(
    new THREE.BoxGeometry(1.52, 2.02, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xd9bf84, wireframe: true }),
  );
  highlight.matrixAutoUpdate = false;
  highlight.visible = false;
  scene.add(highlight);
  return { frames, highlight, ownerCharacters };
}

function isInsideTower(x: number, z: number) {
  return TOWER_CENTERS.some(
    (centerX) => {
      const localX = x - centerX;
      const insideShell =
        Math.abs(localX) <= TOWER_HALF - 1.2 &&
        Math.abs(z) <= TOWER_HALF - 1.2;
      const insideCornerPillar = Math.abs(localX) > 17.35 && Math.abs(z) > 17.35;
      return insideShell && !insideCornerPillar;
    },
  );
}

function isOnBridge(x: number, z: number) {
  return Math.abs(x) <= 15 && Math.abs(z) <= 6.2;
}

function isInsideOwnerCharacter(x: number, z: number, footY: number) {
  if (Math.abs(footY - BRIDGE_Y) > 1.35) return false;
  return OWNER_CHARACTER_PLACEMENTS.some(({ x: ownerX, z: ownerZ }) => {
    const deltaX = x - ownerX;
    const deltaZ = z - ownerZ;
    return deltaX * deltaX + deltaZ * deltaZ < 0.82 * 0.82;
  });
}

function isNavigable(x: number, z: number, footY: number) {
  const bridgeIsReachable = Math.abs(footY - BRIDGE_Y) <= 1.35;
  const isWithinGallery =
    isInsideTower(x, z) || (bridgeIsReachable && isOnBridge(x, z));
  return isWithinGallery && !isInsideOwnerCharacter(x, z, footY);
}

function closestFloorHeight(footY: number): number {
  return FLOOR_HEIGHTS.reduce<number>(
    (closest, current) =>
      Math.abs(current - footY) < Math.abs(closest - footY) ? current : closest,
    FLOOR_HEIGHTS[0],
  );
}

function getGroundHeight(x: number, z: number, currentFootY: number) {
  if (isOnBridge(x, z) && Math.abs(currentFootY - BRIDGE_Y) <= 1.35) {
    return BRIDGE_Y;
  }
  const towerCenter = TOWER_CENTERS.find(
    (centerX) => Math.abs(x - centerX) <= TOWER_HALF - 1.2,
  );
  if (towerCenter === undefined) return 0;

  const localX = x - towerCenter;
  if (Math.abs(z) <= 13.7) {
    let bestHeight = closestFloorHeight(currentFootY);
    let smallestDifference = Math.abs(bestHeight - currentFootY);
    for (let floorIndex = 0; floorIndex < 4; floorIndex += 1) {
      if (Math.abs(localX - STAIR_X_OFFSETS[floorIndex]) > 2.95) continue;
      const ascendingPositiveZ = floorIndex % 2 === 0;
      const t = THREE.MathUtils.clamp(
        ascendingPositiveZ ? (z + 13) / 26 : (13 - z) / 26,
        0,
        1,
      );
      const rampHeight = FLOOR_HEIGHTS[floorIndex] + t * FLOOR_HEIGHT;
      const difference = Math.abs(rampHeight - currentFootY);
      if (difference < smallestDifference + 0.9) {
        bestHeight = rampHeight;
        smallestDifference = difference;
      }
    }
    return bestHeight;
  }
  return closestFloorHeight(currentFootY);
}

function getLocation(position: THREE.Vector3): LocationState {
  const footY = position.y - EYE_HEIGHT;
  if (isOnBridge(position.x, position.z) && Math.abs(footY - BRIDGE_Y) <= 1.35) {
    return { eyebrow: "Observation link", title: "SKYBRIDGE · LEVEL 03" };
  }
  const towerIndex = Math.abs(position.x - TOWER_CENTERS[0]) <
    Math.abs(position.x - TOWER_CENTERS[1]) ? 0 : 1;
  const floorHeight = closestFloorHeight(position.y - EYE_HEIGHT);
  const floor = FLOOR_HEIGHTS.findIndex((height) => height === floorHeight) + 1;
  const start = towerIndex * 500 + (floor - 1) * 100 + 1;
  return {
    eyebrow: `Tower ${towerIndex === 0 ? "A" : "B"} · NFT ${start}–${start + 99}`,
    title: `GALLERY FLOOR ${String(floor).padStart(2, "0")}`,
  };
}

function formatId(id: number) {
  return `#${String(id).padStart(4, "0")}`;
}

export function MonolithExperience() {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectedRef = useRef<number | null>(null);
  const targetRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [location, setLocation] = useState<LocationState>({
    eyebrow: "Observation link",
    title: "SKYBRIDGE · LEVEL 03",
  });

  const selectedRecord = useMemo<FrameRecord | null>(() => {
    if (selectedId === null) return null;
    const tower = selectedId <= 500 ? "A" : "B";
    const withinTower = selectedId - (tower === "A" ? 0 : 500) - 1;
    return {
      id: selectedId,
      tower,
      floor: Math.floor(withinTower / 100) + 1,
      slot: (withinTower % 100) + 1,
    };
  }, [selectedId]);

  const updateSelected = useCallback((id: number | null) => {
    selectedRef.current = id;
    setSelectedId(id);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa8bdcc);
    scene.fog = new THREE.Fog(0x9dacb5, 170, 620);
    const camera = new THREE.PerspectiveCamera(
      70,
      mount.clientWidth / mount.clientHeight,
      0.08,
      900,
    );
    camera.position.set(0, BRIDGE_Y + EYE_HEIGHT, 0);
    camera.rotation.order = "YXZ";
    camera.rotation.y = -Math.PI / 2;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "world-canvas";
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive three-dimensional NFT gallery",
    );
    mount.appendChild(renderer.domElement);
    canvasRef.current = renderer.domElement;

    scene.add(new THREE.HemisphereLight(0xdbe9ef, 0x4d514d, 2.15));
    const sun = new THREE.DirectionalLight(0xffe3b8, 3.1);
    sun.position.set(-115, 190, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -110;
    sun.shadow.camera.right = 110;
    sun.shadow.camera.top = 130;
    sun.shadow.camera.bottom = -80;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 430;
    scene.add(sun);

    const world = createWorld(scene);
    const raycaster = new THREE.Raycaster();
    raycaster.far = 3.2;
    const center = new THREE.Vector2(0, 0);
    const keys = new Set<string>();
    let yaw = -Math.PI / 2;
    let pitch = 0;
    let animationFrame = 0;
    let previousTime = performance.now();
    let previousLocation = "SKYBRIDGE · LEVEL 03";

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    };

    const onMouseMove = (event: MouseEvent) => {
      if (
        document.pointerLockElement !== renderer.domElement ||
        selectedRef.current !== null
      ) return;
      const sensitivity = 0.0018;
      yaw -= event.movementX * sensitivity;
      pitch -= event.movementY * sensitivity;
      pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2.15, Math.PI / 2.15);
      camera.rotation.set(pitch, yaw, 0, "YXZ");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.code);
      if (event.code === "KeyE" && targetRef.current !== null) {
        updateSelected(targetRef.current + 1);
        document.exitPointerLock();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const clearKeys = () => keys.clear();

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === renderer.domElement;
      if (locked) {
        setHasStarted(true);
        setIsPaused(false);
      } else if (selectedRef.current === null) {
        setIsPaused(true);
      }
      if (!locked) clearKeys();
    };

    const onCanvasClick = () => {
      if (
        selectedRef.current === null &&
        document.pointerLockElement !== renderer.domElement
      ) renderer.domElement.requestPointerLock();
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    renderer.domElement.addEventListener("click", onCanvasClick);

    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const movement = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    const animate = (time: number) => {
      const delta = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      const isLocked = document.pointerLockElement === renderer.domElement;

      world.ownerCharacters.forEach(
        ({ wavingArm, restingArmRotation, phase }) => {
          const wave = Math.sin(time * 0.00135 + phase);
          wavingArm.rotation.z = restingArmRotation + wave * 0.22;
          wavingArm.rotation.x = Math.sin(time * 0.0009 + phase) * 0.035;
        },
      );

      if (isLocked && selectedRef.current === null) {
        // Movement follows the camera's local axes: W/S use forward/backward,
        // while A/D use left/right regardless of the current viewing angle.
        forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        right.set(Math.cos(yaw), 0, -Math.sin(yaw));
        movement.set(0, 0, 0);
        if (keys.has("KeyW")) movement.add(forward);
        if (keys.has("KeyS")) movement.sub(forward);
        if (keys.has("KeyD")) movement.add(right);
        if (keys.has("KeyA")) movement.sub(right);

        if (movement.lengthSq() > 0) {
          movement
            .normalize()
            .multiplyScalar((keys.has("ShiftLeft") ? 7.2 : 4.5) * delta);
          const currentFootY = camera.position.y - EYE_HEIGHT;
          const candidateX = camera.position.x + movement.x;
          const candidateZ = camera.position.z + movement.z;
          if (isNavigable(candidateX, camera.position.z, currentFootY)) {
            camera.position.x = candidateX;
          }
          if (isNavigable(camera.position.x, candidateZ, currentFootY)) {
            camera.position.z = candidateZ;
          }
          const groundHeight = getGroundHeight(
            camera.position.x,
            camera.position.z,
            currentFootY,
          );
          camera.position.y = THREE.MathUtils.lerp(
            camera.position.y,
            groundHeight + EYE_HEIGHT,
            Math.min(1, delta * 11),
          );
        }

        raycaster.setFromCamera(center, camera);
        const hit = raycaster.intersectObject(world.frames, false)[0];
        const nextTarget = hit?.instanceId ?? null;
        if (nextTarget !== targetRef.current) {
          targetRef.current = nextTarget;
          setTargetId(nextTarget);
          if (nextTarget === null) {
            world.highlight.visible = false;
          } else {
            world.frames.getMatrixAt(nextTarget, matrix);
            matrix.decompose(position, quaternion, scale);
            scale.multiplyScalar(1.06);
            world.highlight.matrix.compose(position, quaternion, scale);
            world.highlight.visible = true;
          }
        }

        const nextLocation = getLocation(camera.position);
        if (nextLocation.title !== previousLocation) {
          previousLocation = nextLocation.title;
          setLocation(nextLocation);
        }
      } else {
        world.highlight.visible = false;
      }

      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };

    setIsReady(true);
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.map?.dispose();
          }
          material.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
      canvasRef.current = null;
    };
  }, [updateSelected]);

  const enterExperience = useCallback(() => {
    canvasRef.current?.requestPointerLock();
  }, []);

  const closeSheet = useCallback(() => {
    updateSelected(null);
    setTimeout(() => canvasRef.current?.focus(), 0);
  }, [updateSelected]);

  return (
    <main className="experience-shell">
      <div ref={mountRef} className="absolute inset-0" />
      {!isReady ? <div className="loading-overlay">Constructing the gallery</div> : null}

      <div className="hud-layer" aria-hidden={!hasStarted}>
        <div className="brand-lockup">
          <span className="brand-mark" />
          <span>Monolith NFT Gallery</span>
        </div>
        {hasStarted ? (
          <>
            <div className="crosshair" />
            <div className="location-card">
              <div className="location-eyebrow">{location.eyebrow}</div>
              <div className="location-title">{location.title}</div>
            </div>
            {targetId !== null && selectedId === null ? (
              <div className="interaction-prompt">
                <span className="keycap">E</span>
                <span>Inspect NFT {formatId(targetId + 1)}</span>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {isReady && !hasStarted ? (
        <section className="intro-overlay" aria-labelledby="intro-title">
          <div className="intro-panel">
            <div className="intro-index">Archive 001 · Twin Monolith</div>
            <h1 id="intro-title" className="intro-title">
              Monolith<br />NFT Gallery
            </h1>
            <p className="intro-copy">
              A thousand empty frames wait inside two monumental towers. Begin on the
              skybridge, enter either archive and move through five brutalist gallery floors.
            </p>
            <div className="controls-row" aria-label="Controls">
              <span><strong>W</strong> Forward</span>
              <span><strong>A</strong> Left</span>
              <span><strong>S</strong> Back</span>
              <span><strong>D</strong> Right</span>
              <span><strong>Mouse</strong> Look</span>
              <span><strong>Shift</strong> Fast walk</span>
              <span><strong>E</strong> Inspect</span>
              <span><strong>Esc</strong> Pause</span>
            </div>
            <Button className="enter-button" onClick={enterExperience}>
              Enter the skybridge
            </Button>
            <p className="mobile-notice">
              The full first-person experience is designed for desktop keyboard and mouse.
            </p>
          </div>
        </section>
      ) : null}

      {hasStarted && isPaused && selectedId === null ? (
        <section className="pause-overlay" aria-labelledby="pause-title">
          <div className="pause-card">
            <h2 id="pause-title">Experience paused</h2>
            <p>Return to the bridge and continue exploring the archive.</p>
            <Button className="enter-button" onClick={enterExperience}>
              Resume exploration
            </Button>
          </div>
        </section>
      ) : null}

      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent className="nft-sheet" side="right">
          {selectedRecord ? (
            <>
              <SheetHeader className="nft-sheet-header">
                <div className="nft-sheet-kicker">
                  Tower {selectedRecord.tower} · Floor {String(selectedRecord.floor).padStart(2, "0")} · Slot {String(selectedRecord.slot).padStart(3, "0")}
                </div>
                <SheetTitle className="nft-sheet-title">
                  NFT {formatId(selectedRecord.id)}
                </SheetTitle>
                <SheetDescription className="nft-sheet-description">
                  This frame is reserved for a future collection item.
                </SheetDescription>
              </SheetHeader>
              <div className="nft-art-placeholder" aria-label="Empty NFT artwork placeholder">
                <span className="nft-art-status">COMING SOON</span>
                <span className="nft-art-number">{formatId(selectedRecord.id)}</span>
              </div>
              <dl className="nft-details">
                <div className="detail-row"><dt>Collection</dt><dd>Not added yet</dd></div>
                <div className="detail-row"><dt>Owner</dt><dd>Not assigned</dd></div>
                <div className="detail-row"><dt>Network</dt><dd>—</dd></div>
                <div className="detail-row"><dt>Marketplace</dt><dd>—</dd></div>
                <div className="detail-row"><dt>OpenSea price</dt><dd>—</dd></div>
                <div className="detail-row"><dt>Listing status</dt><dd>Awaiting data</dd></div>
              </dl>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
