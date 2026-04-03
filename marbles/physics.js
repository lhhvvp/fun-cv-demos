import * as THREE from "three";
import { halfRoom, restitution } from "./config.js";

// Reusable vectors for collision calculations
const collisionDelta = new THREE.Vector3();
const collisionNormal = new THREE.Vector3();
const collisionRelativeVelocity = new THREE.Vector3();
const collisionImpulse = new THREE.Vector3();
const maintainTempDirection = new THREE.Vector3();
const fallbackDirection = new THREE.Vector3();
const defaultLightDirection = new THREE.Vector3(0, 1, 0);

export function enforceCubeBounds(sphere) {
  const { mesh, velocity, radius } = sphere;
  const position = mesh.position;
  let collided = false;
  let impactStrength = 0;

  const registerImpact = (value) => {
    if (value > impactStrength) {
      impactStrength = value;
    }
  };

  const limit = halfRoom - radius;

  // X axis bounds
  if (position.x > limit) {
    registerImpact(Math.abs(velocity.x));
    position.x = limit;
    velocity.x = -Math.abs(velocity.x);
    collided = true;
  } else if (position.x < -limit) {
    registerImpact(Math.abs(velocity.x));
    position.x = -limit;
    velocity.x = Math.abs(velocity.x);
    collided = true;
  }

  // Y axis bounds
  if (position.y > limit) {
    registerImpact(Math.abs(velocity.y));
    position.y = limit;
    velocity.y = -Math.abs(velocity.y);
    collided = true;
  } else if (position.y < -limit) {
    registerImpact(Math.abs(velocity.y));
    position.y = -limit;
    velocity.y = Math.abs(velocity.y);
    collided = true;
  }

  // Z axis bounds
  if (position.z > limit) {
    registerImpact(Math.abs(velocity.z));
    position.z = limit;
    velocity.z = -Math.abs(velocity.z);
    collided = true;
  } else if (position.z < -limit) {
    registerImpact(Math.abs(velocity.z));
    position.z = -limit;
    velocity.z = Math.abs(velocity.z);
    collided = true;
  }

  return { collided, impactStrength };
}

export function resolveSphereCollision(a, b) {
  const posA = a.mesh.position;
  const posB = b.mesh.position;
  collisionDelta.subVectors(posB, posA);
  const minDistance = a.radius + b.radius;
  let distanceSq = collisionDelta.lengthSq();
  let collisionOccurred = false;
  let impactStrength = 0;

  if (distanceSq === 0) {
    fallbackDirection.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    if (fallbackDirection.lengthSq() < 1e-6) {
      fallbackDirection.set(1, 0, 0);
    }
    fallbackDirection.normalize().multiplyScalar(0.001);
    collisionDelta.copy(fallbackDirection);
    distanceSq = collisionDelta.lengthSq();
  }

  const minDistanceSq = minDistance * minDistance;

  if (distanceSq <= minDistanceSq) {
    const distance = Math.sqrt(distanceSq) || 0.0001;
    collisionNormal.copy(collisionDelta).divideScalar(distance);
    const overlap = minDistance - distance;

    posA.addScaledVector(collisionNormal, -overlap * 0.5);
    posB.addScaledVector(collisionNormal, overlap * 0.5);

    collisionRelativeVelocity.copy(a.velocity).sub(b.velocity);
    const velAlongNormal = collisionRelativeVelocity.dot(collisionNormal);
    const relativeSpeed = collisionRelativeVelocity.length();
    const averageSpeed = 0.5 * (a.velocity.length() + b.velocity.length());
    const overlapRatio = minDistance > 0 ? overlap / minDistance : 0;

    impactStrength = Math.max(
      Math.abs(velAlongNormal),
      relativeSpeed * 0.35,
      averageSpeed * overlapRatio,
      overlapRatio * 0.8
    );

    if (velAlongNormal > 0) {
      const impulseMagnitude = -((1 + restitution) * velAlongNormal) / 2;
      collisionImpulse.copy(collisionNormal).multiplyScalar(impulseMagnitude);

      a.velocity.add(collisionImpulse);
      b.velocity.sub(collisionImpulse);
      collisionOccurred = true;
    }

    const reflectionFactor = 1 + restitution;
    let reflectionApplied = false;

    const postNormalA = a.velocity.dot(collisionNormal);
    if (postNormalA > 0) {
      a.velocity.addScaledVector(collisionNormal, -reflectionFactor * postNormalA);
      reflectionApplied = true;
    }

    const postNormalB = b.velocity.dot(collisionNormal);
    if (postNormalB < 0) {
      b.velocity.addScaledVector(collisionNormal, -reflectionFactor * postNormalB);
      reflectionApplied = true;
    }

    if (reflectionApplied) {
      collisionOccurred = true;
    }
  }

  const clampedImpact = collisionOccurred ? Math.min(Math.max(impactStrength, 0.05), 6) : 0;

  return { collided: collisionOccurred, impactStrength: clampedImpact };
}

export function maintainSphereSpeed(sphere) {
  const { velocity, baseSpeed } = sphere;
  if (!velocity || !Number.isFinite(baseSpeed) || baseSpeed <= 0) {
    return;
  }

  const currentSpeed = velocity.length();
  if (currentSpeed < 1e-6) {
    if (sphere.lastMovementDirection && sphere.lastMovementDirection.lengthSq() > 1e-6) {
      maintainTempDirection.copy(sphere.lastMovementDirection);
    } else {
      fallbackDirection.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      if (fallbackDirection.lengthSq() < 1e-6) {
        fallbackDirection.copy(defaultLightDirection);
      }
      maintainTempDirection.copy(fallbackDirection);
    }

    if (maintainTempDirection.lengthSq() < 1e-6) {
      maintainTempDirection.copy(defaultLightDirection);
    }

    maintainTempDirection.normalize();
    velocity.copy(maintainTempDirection).multiplyScalar(baseSpeed);
    if (!sphere.lastMovementDirection) {
      sphere.lastMovementDirection = new THREE.Vector3();
    }
    sphere.lastMovementDirection.copy(maintainTempDirection);
    return;
  }

  const speedDelta = Math.abs(currentSpeed - baseSpeed);
  if (speedDelta > baseSpeed * 0.0005) {
    velocity.multiplyScalar(baseSpeed / currentSpeed);
  }

  if (!sphere.lastMovementDirection) {
    sphere.lastMovementDirection = new THREE.Vector3();
  }
  sphere.lastMovementDirection.copy(velocity).normalize();
}
