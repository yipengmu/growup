import * as THREE from 'three';

// All scenery stays behind the actor, leaving the central gesture area clear.
export function createCareerEnvironment(scene) {
  const root = new THREE.Group();
  root.name = 'career-environment';
  scene.add(root);
  let motions = [];
  const materials = new Map();
  function material(color, glow = false) {
    const key = `${color}:${glow}`;
    if (!materials.has(key)) materials.set(key, glow
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    return materials.get(key);
  }
  function shape(geometry, color, x, y, z, parent = root, glow = false) {
    const object = new THREE.Mesh(geometry, material(color, glow));
    object.position.set(x, y, z);
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  const box = (w, h, d, color, x, y, z, parent) => shape(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent);
  const ball = (r, color, x, y, z, parent) => shape(new THREE.SphereGeometry(r, 16, 12), color, x, y, z, parent);
  const cylinder = (top, bottom, h, color, x, y, z, parent) => shape(new THREE.CylinderGeometry(top, bottom, h, 24), color, x, y, z, parent);
  function group(x, y, z) {
    const object = new THREE.Group(); object.position.set(x, y, z); root.add(object); return object;
  }
  function ring(r, color, x, y, z, parent = root) {
    return shape(new THREE.TorusGeometry(r, 0.035, 8, 64), color, x, y, z, parent);
  }
  function cross(x, y, z, color, parent = root) {
    box(0.17, 0.56, 0.04, color, x, y, z, parent);
    box(0.56, 0.17, 0.04, color, x, y, z, parent);
  }
  function table(x, z, color = '#b9c7c3') {
    const g = group(x, 0, z);
    box(1.35, 0.12, 0.65, '#fff8e9', 0, 0.98, 0, g);
    for (const side of [-0.52, 0.52]) box(0.09, 1, 0.48, color, side, 0.42, 0, g);
    return g;
  }
  function plant(x, z, size = 1, flowers = false) {
    const g = group(x, 0, z); g.scale.setScalar(size);
    cylinder(0.24, 0.17, 0.4, '#c39876', 0, 0.1, 0, g);
    cylinder(0.025, 0.025, 0.95, '#809b6b', 0, 0.7, 0, g);
    for (let i = 0; i < 4; i++) {
      const leaf = ball(0.2, i % 2 ? '#a5bf87' : '#87a975', (i % 2 ? -1 : 1) * 0.13, 0.55 + i * 0.15, 0, g);
      leaf.scale.set(1, 0.45, 0.5); leaf.rotation.z = i % 2 ? -0.6 : 0.6;
    }
    if (flowers) {
      for (let i = 0; i < 6; i++) ball(0.11, '#e8b8a7', Math.cos(i * Math.PI / 3) * 0.16, 1.25 + Math.sin(i * Math.PI / 3) * 0.16, 0, g);
      ball(0.1, '#edd789', 0, 1.25, 0.07, g);
    }
    return g;
  }
  function windowFrame(color, outdoor = false) {
    box(7.8, 3.9, 0.12, color, 0, 1.8, -3.6);
    box(6.9, 2.65, 0.08, outdoor ? '#d9e8d5' : '#edf5ef', 0, 2.15, -3.5);
    for (const x of [-3.48, 0, 3.48]) box(0.07, 2.8, 0.1, '#fcf8ed', x, 2.15, -3.42);
    box(7.1, 0.08, 0.12, '#fcf8ed', 0, 0.8, -3.4);
    box(7.1, 0.08, 0.12, '#fcf8ed', 0, 3.5, -3.4);
  }
  const builders = {
    space() {
      const planet = ball(0.66, '#b7cbdc', 2.6, 3.1, -4.3);
      const orbit = ring(0.95, '#e1daca', 0, 0, 0, planet); orbit.rotation.x = 1.1; orbit.rotation.y = 0.3;
      for (let i = 0; i < 42; i++) {
        shape(new THREE.OctahedronGeometry(i % 5 ? 0.024 : 0.055), '#ffffff', Math.sin(i * 7.3) * 5.8, 1.4 + (i % 9) * 0.38, -4 - i % 3, root, true);
      }
      for (let i = 0; i < 8; i++) {
        const rock = shape(new THREE.DodecahedronGeometry(0.16 + i % 3 * 0.06), '#b9b2c8', (i % 2 ? -1 : 1) * (1.9 + i * 0.12), 0, -0.8 - i * 0.3);
        rock.scale.y = 0.6;
      }
      const rocket = group(-2.6, 0, -2.2);
      cylinder(0.25, 0.3, 1.25, '#f6f0e7', 0, 1.1, 0, rocket);
      shape(new THREE.ConeGeometry(0.25, 0.5, 24), '#b99cb7', 0, 1.98, 0, rocket);
      ball(0.16, '#9bbed1', 0, 1.3, 0.24, rocket);
      for (const x of [-0.32, 0.32]) box(0.18, 0.5, 0.25, '#b99cb7', x, 0.5, 0, rocket);
      cylinder(0.35, 0.43, 0.15, '#c2b7cf', 0, 0.15, 0, rocket);
    },
    science() {
      windowFrame('#c9ded4');
      const bench = table(-2.5, -1.7, '#91b5a5');
      for (let i = 0; i < 3; i++) {
        cylinder(0.11, 0.19, 0.32 + i * 0.12, ['#b4d6c7', '#d3c2dd', '#e2ce8d'][i], -0.4 + i * 0.4, 1.22 + i * 0.06, 0, bench);
        cylinder(0.055, 0.055, 0.16, '#f0f6ed', -0.4 + i * 0.4, 1.48 + i * 0.12, 0, bench);
      }
      const atom = group(2.55, 2, -2.1);
      for (let i = 0; i < 3; i++) { const orbit = ring(0.55, '#8baea3', 0, 0, 0, atom); orbit.rotation.set(i * 1.05, i * 0.7, 0); }
      ball(0.17, '#dec794', 0, 0, 0, atom);
      motions.push(t => { atom.rotation.y = t * 0.12; });
      box(1.25, 0.65, 0.6, '#abc6b8', 2.55, 0.25, -2.1);
    },
    doctor() {
      windowFrame('#c7dfe2');
      box(1.2, 1.8, 0.45, '#f2f5ed', -2.65, 0.8, -2.2);
      cross(-2.65, 1.25, -1.95, '#86b9b5');
      for (let i = 0; i < 2; i++) box(1, 0.025, 0.04, '#cadbd5', -2.65, 0.28 + i * 0.32, -1.94);
      box(1.35, 0.9, 0.12, '#a2bdbd', 2.5, 1.85, -2);
      box(1.18, 0.73, 0.04, '#e3f0e6', 2.5, 1.85, -1.91);
      const points = [[-0.48,0],[-0.25,0],[-0.12,0.19],[0,-0.18],[0.12,0.08],[0.23,0],[0.48,0]].map(([x,y]) => new THREE.Vector3(x + 2.5, y + 1.85, -1.88));
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#70a99b' })));
      cylinder(0.04, 0.04, 1.4, '#aac5bf', 2.5, 0.6, -2);
      plant(3.15, -2.8, 0.65);
    },
    fire() {
      windowFrame('#dfc4af');
      box(1.4, 2.6, 0.2, '#d29d82', -2.7, 1.2, -2.8);
      box(1.17, 1.85, 0.06, '#f2d9bc', -2.7, 0.84, -2.66);
      for (let i = 0; i < 6; i++) box(1.13, 0.025, 0.02, '#d6b496', -2.7, 0.1 + i * 0.3, -2.61);
      const truck = group(2.7, 0, -2);
      box(1.55, 0.65, 0.65, '#cc8568', 0, 0.55, 0, truck);
      box(0.45, 0.42, 0.6, '#dfab87', -0.48, 1.02, 0, truck);
      box(0.3, 0.24, 0.03, '#d2e3de', -0.48, 1.06, 0.32, truck);
      for (const x of [-0.5,0.5]) { const wheel = cylinder(0.2, 0.2, 0.7, '#736d6a', x, 0.19, 0, truck); wheel.rotation.x = Math.PI / 2; }
      for (const x of [-0.15,0.55]) box(0.045, 0.12, 0.04, '#eee1bd', x, 1.03, 0, truck);
      box(0.95, 0.05, 0.09, '#eee1bd', 0.2, 1.1, 0, truck);
      ball(0.09, '#edcf8a', -0.48, 1.3, 0, truck);
    },
    soldier() {
      windowFrame('#c7d4bc', true);
      for (const x of [-3.1, 3.1]) {
        cylinder(0.09, 0.12, 1.3, '#a9aa83', x, 0.45, -2.8);
        for (let i = 0; i < 3; i++) shape(new THREE.ConeGeometry(0.6 - i * 0.1, 0.9, 12), '#8fa37c', x, 1 + i * 0.42, -2.8);
      }
      const tent = group(-2.2, 0, -2.1);
      const roof = shape(new THREE.CylinderGeometry(0.8, 0.8, 1.3, 3), '#acb58c', 0, 0.55, 0, tent);
      roof.rotation.z = Math.PI / 2;
      box(0.34, 0.6, 0.03, '#798c69', 0, 0.23, 0.66, tent);
      cylinder(0.025, 0.025, 2.5, '#b5bca4', 2.2, 1.1, -2);
      const flag = box(0.7, 0.42, 0.03, '#c38373', 2.55, 2.1, -2);
      motions.push(t => { flag.rotation.y = Math.sin(t * 0.8) * 0.1; });
      shape(new THREE.OctahedronGeometry(0.09), '#e9d293', 2.35, 2.16, -1.96);
    },
    engineer() {
      windowFrame('#ded5bb');
      const crane = group(-2.8, 0, -2.5);
      for (const x of [-0.16,0.16]) box(0.06, 3, 0.1, '#c4aa6e', x, 1.35, 0, crane);
      for (let i = 0; i < 7; i++) box(0.38, 0.04, 0.12, '#c4aa6e', 0, i * 0.4, 0, crane);
      box(1.75, 0.14, 0.2, '#d7bd7c', 0.45, 2.85, 0, crane);
      box(0.025, 0.85, 0.025, '#a29c87', 1.18, 2.35, 0, crane);
      box(0.45, 0.35, 0.4, '#b7c5bd', 1.18, 1.78, 0, crane);
      const bench = table(2.6, -1.8, '#b5ab8d');
      box(0.9, 0.025, 0.47, '#a8c6d1', 0, 1.06, 0, bench);
      for (let i = 0; i < 3; i++) box(0.65, 0.008, 0.014, '#e5f1ed', 0, 1.08, -0.14 + i * 0.14, bench);
      for (let i = 0; i < 3; i++) box(0.38, 0.35 + i * 0.2, 0.45, ['#b6c7c9','#d9c893','#c9b69f'][i], 2.05 + i * 0.44, 0.1 + i * 0.1, -2.8);
    },
    artist() {
      windowFrame('#dfcbd4');
      const easel = group(-2.5, 0, -1.9);
      for (const x of [-0.4, 0.4]) { const leg = box(0.06, 2, 0.09, '#bea486', x, 0.85, 0, easel); leg.rotation.z = x > 0 ? 0.12 : -0.12; }
      box(1.2, 1.3, 0.09, '#c2a68b', 0, 1.6, 0.03, easel);
      box(1.05, 1.15, 0.025, '#fff3de', 0, 1.6, 0.1, easel);
      ball(0.22, '#ebcb8e', -0.24, 1.9, 0.12, easel).scale.z = 0.08;
      const hill = ball(0.46, '#a6bca2', 0.12, 1.2, 0.12, easel); hill.scale.set(1, 0.7, 0.06);
      const bench = table(2.5, -1.9, '#c4a8b5');
      for (let i = 0; i < 4; i++) {
        cylinder(0.09, 0.09, 0.22, ['#dba795','#e2cf8c','#a6c2b0','#b3a4cf'][i], -0.45 + i * 0.3, 1.15, 0, bench);
        cylinder(0.012, 0.012, 0.45, '#b69b7e', -0.45 + i * 0.3, 1.42, 0, bench);
      }
    },
    chef() {
      windowFrame('#e0cdb9');
      for (const x of [-2.5, 2.5]) {
        box(1.5, 0.95, 0.7, '#c4b6a0', x, 0.36, -1.9);
        box(1.6, 0.1, 0.78, '#fbf0db', x, 0.88, -1.9);
      }
      box(1.1, 0.6, 0.06, '#8f9994', -2.5, 0.4, -1.52);
      box(0.88, 0.37, 0.03, '#c0ccc3', -2.5, 0.38, -1.47);
      for (const x of [-2.8,-2.5,-2.2]) ball(0.045, '#f4e4c5', x, 0.79, -1.49);
      cylinder(0.32, 0.28, 0.35, '#b0c6bf', -2.5, 1.12, -1.9);
      cylinder(0.35, 0.35, 0.06, '#d2ded2', -2.5, 1.32, -1.9);
      ball(0.055, '#9eaca4', -2.5, 1.39, -1.9);
      cylinder(0.35, 0.18, 0.2, '#f4e4c5', 2.5, 1.04, -1.9);
      for (let i = 0; i < 3; i++) ball(0.13, ['#dba289','#d8c57f','#a4b880'][i], 2.3 + i * 0.19, 1.2, -1.9, root);
      for (let i = 0; i < 3; i++) {
        const steam = ball(0.05, '#f9f3e5', -2.6 + i * 0.1, 1.6 + i * 0.15, -1.9); steam.scale.set(0.6, 1.8, 0.6);
        motions.push(t => { steam.position.y = 1.6 + i * 0.15 + Math.sin(t * 0.8 + i) * 0.06; });
      }
    },
    garden() {
      windowFrame('#bbcfad', true);
      for (const x of [-2.8, 2.8]) {
        box(1.7, 0.4, 0.75, '#bea584', x, 0.08, -1.9);
        box(1.55, 0.06, 0.64, '#9c977a', x, 0.3, -1.9);
        for (let i = 0; i < 3; i++) plant(x - 0.5 + i * 0.5, -1.9, 0.7 + i * 0.1, true).position.y = 0.3;
      }
      cylinder(0.04, 0.04, 3.9, '#eff1d9', -3.5, 1.75, -3.35);
      cylinder(0.04, 0.04, 3.9, '#eff1d9', 3.5, 1.75, -3.35);
      ball(0.35, '#eadba2', -2.3, 3, -3.3).scale.z = 0.15;
      for (let i = 0; i < 3; i++) {
        const mote = ball(0.035, '#faf0c6', (i % 2 ? -1 : 1) * 2.1, 1.8 + i * 0.4, -1.4);
        motions.push(t => { mote.position.y = 1.8 + i * 0.4 + Math.sin(t * 0.6 + i) * 0.12; });
      }
    },
  };
  function clear() {
    root.traverse(object => { object.geometry?.dispose(); });
    root.clear();
    materials.forEach(value => value.dispose()); materials.clear(); motions = [];
  }
  return {
    setCareer(id) { clear(); (builders[id] || builders.space)(); },
    update(time, quiet = false) { for (const move of motions) move(quiet ? 0 : time); },
    dispose() { clear(); scene.remove(root); },
  };
}
