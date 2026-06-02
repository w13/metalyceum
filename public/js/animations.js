// Swimming and other movement animations
import * as THREE from 'three';

export function animateAvatarSwim(playerObj, dt, now) {
  const leftLeg = playerObj.leftLeg;
  const rightLeg = playerObj.rightLeg;
  const leftArm = playerObj.leftArm;
  const rightArm = playerObj.rightArm;
  if (!leftLeg || !rightLeg) return;

  const st = now * 0.01;
  const kick = 0.5;
  // Frog-kick: alternating legs
  leftLeg.rotation.x = Math.sin(st) * kick;
  rightLeg.rotation.x = -Math.sin(st) * kick;
  // Breaststroke arms
  if (leftArm && rightArm) {
    leftArm.rotation.x = Math.cos(st + 0.5) * 0.6;
    rightArm.rotation.x = -Math.cos(st + 0.5) * 0.6;
  }
}
