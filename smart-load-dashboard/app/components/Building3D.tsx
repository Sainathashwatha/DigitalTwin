"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Box,
  Text,
  OrbitControls,
  useCursor,
  ContactShadows,
  MeshReflectorMaterial,
  Environment,
  Cylinder,
} from "@react-three/drei";
import * as THREE from "three";

const BACKEND_API = "/backend";

type LiveData = {
  groundFloorRoom: boolean;
  firstFloorLab: boolean;
  secondFloorRoom: boolean;
  solarVoltage: number;
  measuredCurrent: number;
  estimatedCurrent: number;
  estimatedPower: number;
  groundFloorEquivalent: number;
  firstFloorEquivalent: number;
  secondFloorEquivalent: number;
};

const defaultLiveData: LiveData = {
  groundFloorRoom: true,
  firstFloorLab: true,
  secondFloorRoom: true,
  solarVoltage: 24.0,
  measuredCurrent: 14.5,
  estimatedCurrent: 14.5,
  estimatedPower: 3335.0,
  groundFloorEquivalent: 3.6,
  firstFloorEquivalent: 10.2,
  secondFloorEquivalent: 3.8,
};

function getRoomData(label: string, liveData: LiveData) {
  const lineVoltage = 230.0;
  if (label === "Ground Floor Room") {
    const cur = liveData.groundFloorRoom ? (liveData.groundFloorEquivalent || 3.8) : 0.05;
    const pwr = liveData.groundFloorRoom ? Math.round(cur * lineVoltage) : 10;
    return {
      isActive: liveData.groundFloorRoom,
      voltage: lineVoltage,
      current: cur,
      power: pwr,
      predicted: Math.round(pwr * 1.05),
      status: liveData.groundFloorRoom ? "ACTIVE" : "STANDBY",
    };
  }

  if (label === "First Floor Lab") {
    const cur = liveData.firstFloorLab ? (liveData.firstFloorEquivalent || 9.1) : 0.08;
    const pwr = liveData.firstFloorLab ? Math.round(cur * lineVoltage) : 15;
    return {
      isActive: liveData.firstFloorLab,
      voltage: lineVoltage,
      current: cur,
      power: pwr,
      predicted: Math.round(pwr * 1.08),
      status: liveData.firstFloorLab ? "ACTIVE" : "STANDBY",
    };
  }

  if (label === "Second Floor Room") {
    const cur = liveData.secondFloorRoom ? (liveData.secondFloorEquivalent || 3.84) : 0.05;
    const pwr = liveData.secondFloorRoom ? Math.round(cur * lineVoltage) : 10;
    return {
      isActive: liveData.secondFloorRoom,
      voltage: lineVoltage,
      current: cur,
      power: pwr,
      predicted: Math.round(pwr * 1.05),
      status: liveData.secondFloorRoom ? "ACTIVE" : "STANDBY",
    };
  }

  return {
    isActive: false,
    voltage: 0,
    current: 0,
    power: 0,
    predicted: 0,
    status: "NO LOAD",
  };
}

const GlassPillar = ({
  position,
  height = 2.9,
}: {
  position: [number, number, number];
  height?: number;
}) => (
  <Box args={[0.18, height, 0.18]} position={position} castShadow receiveShadow>
    <meshPhysicalMaterial
      color="#94a3b8"
      transparent
      opacity={0.9}
      transmission={0.35}
      roughness={0.15}
      metalness={0.7}
      clearcoat={1}
    />
  </Box>
);

const WindowStrip = ({
  position,
  args,
}: {
  position: [number, number, number];
  args: [number, number, number];
}) => (
  <Box args={args} position={position} castShadow>
    <meshPhysicalMaterial
      color="#0f172a"
      emissive="#38bdf8"
      emissiveIntensity={0.18}
      metalness={0.8}
      roughness={0.08}
      transmission={0.15}
      clearcoat={1}
    />
  </Box>
);

const SolarPanelTile = ({
  position,
  intensity,
}: {
  position: [number, number, number];
  intensity: number;
}) => {
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity =
        0.15 + intensity * 0.9 + Math.sin(t * 3 + position[0]) * 0.08;
    }
  });

  return (
    <group position={position}>
      <group rotation={[-Math.PI / 6, 0, 0]}>
        <Box args={[1.4, 0.08, 1]} castShadow>
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.35} />
        </Box>

        <Box
          ref={glowRef}
          args={[1.28, 0.05, 0.9]}
          position={[0, 0.03, 0]}
          castShadow
        >
          <meshPhysicalMaterial
            color="#020617"
            emissive="#22d3ee"
            emissiveIntensity={0.3}
            metalness={1}
            roughness={0.05}
            clearcoat={1}
            reflectivity={1}
          />
        </Box>

        <Box args={[1.18, 0.002, 0.02]} position={[0, 0.056, -0.25]}>
          <meshBasicMaterial color="#38bdf8" />
        </Box>
        <Box args={[1.18, 0.002, 0.02]} position={[0, 0.056, 0]}>
          <meshBasicMaterial color="#38bdf8" />
        </Box>
        <Box args={[1.18, 0.002, 0.02]} position={[0, 0.056, 0.25]}>
          <meshBasicMaterial color="#38bdf8" />
        </Box>

        <Box args={[0.02, 0.002, 0.82]} position={[-0.32, 0.056, 0]}>
          <meshBasicMaterial color="#38bdf8" />
        </Box>
        <Box args={[0.02, 0.002, 0.82]} position={[0, 0.056, 0]}>
          <meshBasicMaterial color="#38bdf8" />
        </Box>
        <Box args={[0.02, 0.002, 0.82]} position={[0.32, 0.056, 0]}>
          <meshBasicMaterial color="#38bdf8" />
        </Box>
      </group>
    </group>
  );
};

const DesktopApparatus = ({
  position,
}: {
  position: [number, number, number];
}) => (
  <group position={position}>
    <Box args={[0.9, 0.08, 0.45]} position={[0, 0.18, 0]} castShadow>
      <meshStandardMaterial color="#334155" />
    </Box>

    <Box args={[0.45, 0.28, 0.05]} position={[0, 0.45, -0.05]} castShadow>
      <meshPhysicalMaterial
        color="#38bdf8"
        emissive="#0284c7"
        emissiveIntensity={0.45}
        clearcoat={1}
        metalness={0.35}
        roughness={0.12}
      />
    </Box>

    <Box args={[0.08, 0.14, 0.08]} position={[0, 0.28, 0.08]} castShadow>
      <meshStandardMaterial color="#0f172a" />
    </Box>

    <Box args={[0.18, 0.28, 0.18]} position={[0.32, 0.32, 0]} castShadow>
      <meshStandardMaterial color="#1e293b" />
    </Box>
  </group>
);

const MachineMotor = ({
  position,
  active,
}: {
  position: [number, number, number];
  active: boolean;
}) => {
  const rotorRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (rotorRef.current && active) rotorRef.current.rotation.z += 0.08;
  });

  return (
    <group position={position}>
      <Box args={[1.2, 0.12, 0.8]} position={[0, 0.06, 0]} castShadow>
        <meshStandardMaterial color="#0f172a" />
      </Box>

      <group ref={rotorRef} position={[0, 0.38, 0]}>
        <Cylinder args={[0.28, 0.28, 0.95]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <meshStandardMaterial
            color={active ? "#f59e0b" : "#64748b"}
            metalness={0.75}
            roughness={0.28}
          />
        </Cylinder>
      </group>

      <Box args={[0.15, 0.24, 0.15]} position={[-0.42, 0.26, 0]} castShadow>
        <meshStandardMaterial color="#1e293b" />
      </Box>
      <Box args={[0.15, 0.24, 0.15]} position={[0.42, 0.26, 0]} castShadow>
        <meshStandardMaterial color="#1e293b" />
      </Box>
    </group>
  );
};

const CeilingFan = ({
  position,
  active,
}: {
  position: [number, number, number];
  active: boolean;
}) => {
  const fanRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (fanRef.current && active) fanRef.current.rotation.y += 0.12;
  });

  return (
    <group position={position}>
      <Cylinder args={[0.02, 0.02, 0.28]} position={[0, -0.15, 0]}>
        <meshStandardMaterial color="#94a3b8" />
      </Cylinder>

      <group ref={fanRef} position={[0, -0.3, 0]}>
        <Cylinder args={[0.09, 0.09, 0.06]}>
          <meshStandardMaterial color="#1e293b" />
        </Cylinder>

        <Box args={[0.95, 0.018, 0.12]} position={[0, 0, 0]} castShadow>
          <meshStandardMaterial color={active ? "#e2e8f0" : "#475569"} />
        </Box>
        <Box args={[0.12, 0.018, 0.95]} position={[0, 0, 0]} castShadow>
          <meshStandardMaterial color={active ? "#e2e8f0" : "#475569"} />
        </Box>
      </group>
    </group>
  );
};

function RoomInterior({
  label,
  args,
  liveData,
}: {
  label: string;
  args: [number, number, number];
  liveData: LiveData;
}) {
  const floorY = -args[1] / 2;
  const ceilingY = args[1] / 2;

  if (label === "Ground Floor Room") {
    return (
      <>
        <DesktopApparatus position={[0, floorY + 0.08, -0.7]} />
        <Box args={[1.1, 0.75, 0.12]} position={[-1.35, floorY + 0.42, 1.2]} castShadow>
          <meshPhysicalMaterial
            color="#1e293b"
            emissive="#0ea5e9"
            emissiveIntensity={0.18}
          />
        </Box>
        <CeilingFan position={[0, ceilingY - 0.05, 0]} active={liveData.groundFloorRoom} />
      </>
    );
  }

  if (label === "First Floor Lab") {
    return (
      <>
        <MachineMotor position={[0, floorY + 0.02, -0.5]} active={liveData.firstFloorLab} />
        <DesktopApparatus position={[-1.4, floorY + 0.08, 1.1]} />
        <DesktopApparatus position={[1.4, floorY + 0.08, 1.1]} />
        <CeilingFan position={[-1.2, ceilingY - 0.05, 0]} active={liveData.firstFloorLab} />
        <CeilingFan position={[1.2, ceilingY - 0.05, 0]} active={liveData.firstFloorLab} />
      </>
    );
  }

  if (label === "Second Floor Room") {
    return (
      <>
        <DesktopApparatus position={[0, floorY + 0.08, -0.7]} />
        <Box args={[1.4, 0.08, 0.45]} position={[0, floorY + 0.2, 1.2]} castShadow>
          <meshStandardMaterial color="#334155" />
        </Box>
        <CeilingFan position={[0, ceilingY - 0.05, 0]} active={liveData.secondFloorRoom} />
      </>
    );
  }

  return null;
}

function CyberRoom({
  args,
  position,
  label,
  isSelected,
  onClick,
  liveData,
}: {
  args: [number, number, number];
  position: [number, number, number];
  label: string;
  isSelected: boolean;
  onClick: () => void;
  liveData: LiveData;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const materialRef = useRef<any>(null);

  const data = useMemo(() => getRoomData(label, liveData), [label, liveData]);

  const bodyColor = isSelected
    ? data.isActive
      ? "#10b981"
      : "#475569"
    : hovered
    ? "#0ea5e9"
    : data.isActive
    ? "#166534"
    : "#1e293b";

  const emissiveColor = isSelected
    ? data.isActive
      ? "#059669"
      : "#334155"
    : hovered
    ? "#0284c7"
    : data.isActive
    ? "#14532d"
    : "#000000";

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = isSelected
        ? 0.55
        : hovered
        ? 0.35
        : data.isActive
        ? 0.2
        : 0;
    }
  });

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      scale={hovered || isSelected ? 1.025 : 1}
    >
      <Box args={args} castShadow receiveShadow>
        <meshPhysicalMaterial
          ref={materialRef}
          color={bodyColor}
          emissive={emissiveColor}
          transparent
          opacity={0.72}
          transmission={0.28}
          thickness={1.2}
          roughness={0.16}
          metalness={0.75}
          clearcoat={1}
          clearcoatRoughness={0.08}
        />
      </Box>

      <Box
        args={[args[0] - 0.28, 0.08, args[2] - 0.28]}
        position={[0, -args[1] / 2 + 0.04, 0]}
        castShadow
      >
        <meshStandardMaterial color="#0f172a" />
      </Box>

      <Box
        args={[args[0] - 0.18, 0.06, args[2] - 0.18]}
        position={[0, args[1] / 2 - 0.03, 0]}
        castShadow
      >
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.25} />
      </Box>

      <GlassPillar position={[-args[0] / 2 + 0.18, 0, -args[2] / 2 + 0.18]} height={args[1]} />
      <GlassPillar position={[args[0] / 2 - 0.18, 0, -args[2] / 2 + 0.18]} height={args[1]} />
      <GlassPillar position={[-args[0] / 2 + 0.18, 0, args[2] / 2 - 0.18]} height={args[1]} />
      <GlassPillar position={[args[0] / 2 - 0.18, 0, args[2] / 2 - 0.18]} height={args[1]} />

      <RoomInterior label={label} args={args} liveData={liveData} />

      <Text
        position={[0, 0, args[2] / 2 + 0.28]}
        fontSize={0.34}
        color={isSelected || hovered ? "#ffffff" : "#cbd5e1"}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#020617"
      >
        {label}
      </Text>
    </group>
  );
}

function Slab({
  position,
  top = false,
}: {
  position: [number, number, number];
  top?: boolean;
}) {
  return (
    <group position={position}>
      <Box args={[14, 0.28, 8]} castShadow receiveShadow>
        <meshStandardMaterial
          color={top ? "#1e293b" : "#0f172a"}
          roughness={0.35}
          metalness={0.82}
        />
      </Box>

      <Box args={[14.2, 0.04, 8.2]} position={[0, 0.16, 0]} castShadow>
        <meshStandardMaterial color="#334155" metalness={0.95} roughness={0.18} />
      </Box>
    </group>
  );
}

function DummyWing({
  position,
  args,
  label,
}: {
  position: [number, number, number];
  args: [number, number, number];
  label?: string;
}) {
  return (
    <group position={position}>
      <Box args={args} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#1e293b"
          emissive="#0f172a"
          emissiveIntensity={0.08}
          transparent
          opacity={0.82}
          transmission={0.12}
          roughness={0.2}
          metalness={0.72}
          clearcoat={1}
        />
      </Box>

      <Box
        args={[args[0] - 0.2, 0.06, args[2] - 0.2]}
        position={[0, args[1] / 2 - 0.02, 0]}
        castShadow
      >
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.22} />
      </Box>

      <WindowStrip position={[0, 0.3, args[2] / 2 + 0.02]} args={[args[0] - 0.5, 0.38, 0.04]} />
      <WindowStrip position={[0, -0.45, args[2] / 2 + 0.02]} args={[args[0] - 0.5, 0.32, 0.04]} />

      <GlassPillar position={[-args[0] / 2 + 0.16, 0, -args[2] / 2 + 0.16]} height={args[1]} />
      <GlassPillar position={[args[0] / 2 - 0.16, 0, -args[2] / 2 + 0.16]} height={args[1]} />
      <GlassPillar position={[-args[0] / 2 + 0.16, 0, args[2] / 2 - 0.16]} height={args[1]} />
      <GlassPillar position={[args[0] / 2 - 0.16, 0, args[2] / 2 - 0.16]} height={args[1]} />

      {label && (
        <Text
          position={[0, 0, args[2] / 2 + 0.24]}
          fontSize={0.22}
          color="#cbd5e1"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#020617"
        >
          {label}
        </Text>
      )}
    </group>
  );
}

function CorridorConnector({
  position,
  args,
}: {
  position: [number, number, number];
  args: [number, number, number];
}) {
  return (
    <group position={position}>
      <Box args={args} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#334155"
          emissive="#0ea5e9"
          emissiveIntensity={0.08}
          transparent
          opacity={0.7}
          transmission={0.18}
          roughness={0.16}
          metalness={0.78}
          clearcoat={1}
        />
      </Box>
      <WindowStrip position={[0, 0, args[2] / 2 + 0.02]} args={[args[0] - 0.18, 0.3, 0.03]} />
    </group>
  );
}

function EntranceBlock() {
  return (
    <group position={[0, -2.7, 4.9]}>
      <Box args={[4.4, 1.5, 1.8]} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#1e293b"
          emissive="#0f172a"
          emissiveIntensity={0.1}
          roughness={0.18}
          metalness={0.8}
          transmission={0.12}
          transparent
          opacity={0.95}
        />
      </Box>

      <Box args={[1.3, 1.1, 0.08]} position={[0, -0.05, 0.94]} castShadow>
        <meshPhysicalMaterial
          color="#0f172a"
          emissive="#22d3ee"
          emissiveIntensity={0.2}
          transmission={0.35}
          transparent
          opacity={0.75}
        />
      </Box>

      <Box args={[5.3, 0.18, 2.4]} position={[0, -0.92, 0.4]} castShadow receiveShadow>
        <meshStandardMaterial color="#334155" />
      </Box>
      <Box args={[6.2, 0.16, 3]} position={[0, -1.18, 0.65]} castShadow receiveShadow>
        <meshStandardMaterial color="#475569" />
      </Box>
      <Box args={[7.2, 0.16, 3.8]} position={[0, -1.42, 0.95]} castShadow receiveShadow>
        <meshStandardMaterial color="#64748b" />
      </Box>

      <Text
        position={[0, 0.85, 0.95]}
        fontSize={0.26}
        color="#e2e8f0"
        anchorX="center"
        outlineWidth={0.03}
        outlineColor="#020617"
      >
        ELECTRICAL DEPARTMENT
      </Text>
    </group>
  );
}

function RooftopUtilities() {
  return (
    <group position={[0, 10.05, -2.1]}>
      <Box args={[1.2, 0.8, 1]} position={[-4.5, 0.35, 0]} castShadow>
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </Box>
      <Box args={[1.6, 0.5, 1.1]} position={[-2.9, 0.2, 0]} castShadow>
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.22} />
      </Box>
      <Cylinder args={[0.24, 0.24, 1.2]} position={[3.8, 0.6, 0]} castShadow>
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.18} />
      </Cylinder>
      <Box args={[1.4, 0.45, 1]} position={[5.1, 0.2, 0]} castShadow>
        <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.2} />
      </Box>
    </group>
  );
}

function BuildingModel({
  selectedRoom,
  setSelectedRoom,
  liveData,
}: {
  selectedRoom: string | null;
  setSelectedRoom: (room: string | null) => void;
  liveData: LiveData;
}) {
  const handleClick = (label: string) => {
    setSelectedRoom(selectedRoom === label ? null : label);
  };

  const solarIntensity = Math.min(1, Math.max(0, liveData.solarVoltage / 12));

  return (
    <group position={[0, -4, 0]}>
      <Box args={[22, 0.5, 14]} position={[0, -1.05, 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#0b1220" metalness={0.7} roughness={0.45} />
      </Box>

      <EntranceBlock />

      <Slab position={[0, -0.1, 0]} />

      <DummyWing position={[-5.3, 1.55, 0]} args={[3.2, 2.6, 5.4]} label="Office Wing" />
      <DummyWing position={[5.3, 1.55, 0]} args={[3.2, 2.6, 5.4]} label="Seminar Hall" />

      <CorridorConnector position={[-2.95, 1.55, 0]} args={[1.5, 2.1, 2.2]} />
      <CorridorConnector position={[2.95, 1.55, 0]} args={[1.5, 2.1, 2.2]} />

      <CyberRoom
        args={[5.4, 2.8, 5.8]}
        position={[0, 1.55, 0]}
        label="Ground Floor Room"
        isSelected={selectedRoom === "Ground Floor Room"}
        onClick={() => handleClick("Ground Floor Room")}
        liveData={liveData}
      />

      <Slab position={[0, 3.1, 0]} />

      <DummyWing position={[-5.5, 4.7, 0]} args={[3.4, 2.7, 5.8]} label="Faculty Cabins" />
      <DummyWing position={[5.5, 4.7, 0]} args={[3.4, 2.7, 5.8]} label="Classroom Block" />

      <CorridorConnector position={[-3.2, 4.7, 0]} args={[1.6, 2.2, 2.4]} />
      <CorridorConnector position={[3.2, 4.7, 0]} args={[1.6, 2.2, 2.4]} />

      <CyberRoom
        args={[6.2, 2.9, 6.3]}
        position={[0, 4.7, 0]}
        label="First Floor Lab"
        isSelected={selectedRoom === "First Floor Lab"}
        onClick={() => handleClick("First Floor Lab")}
        liveData={liveData}
      />

      <Slab position={[0, 6.25, 0]} />

      <DummyWing position={[-5.3, 7.8, 0]} args={[3.2, 2.6, 5.3]} label="Research Room" />
      <DummyWing position={[5.3, 7.8, 0]} args={[3.2, 2.6, 5.3]} label="Project Studio" />

      <CorridorConnector position={[-2.95, 7.8, 0]} args={[1.5, 2.1, 2.2]} />
      <CorridorConnector position={[2.95, 7.8, 0]} args={[1.5, 2.1, 2.2]} />

      <CyberRoom
        args={[5.4, 2.8, 5.8]}
        position={[0, 7.8, 0]}
        label="Second Floor Room"
        isSelected={selectedRoom === "Second Floor Room"}
        onClick={() => handleClick("Second Floor Room")}
        liveData={liveData}
      />

      <Slab position={[0, 9.35, 0]} top />

      <Box args={[0.32, 9.8, 0.32]} position={[-3.4, 4.6, -2.8]} castShadow>
        <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
      </Box>
      <Box args={[0.32, 9.8, 0.32]} position={[-3.4, 4.6, 2.8]} castShadow>
        <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
      </Box>
      <Box args={[0.32, 9.8, 0.32]} position={[3.4, 4.6, -2.8]} castShadow>
        <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
      </Box>
      <Box args={[0.32, 9.8, 0.32]} position={[3.4, 4.6, 2.8]} castShadow>
        <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
      </Box>

      <group position={[0.7, 10, 0]}>
        {Array.from({ length: 2 }).map((_, r) =>
          Array.from({ length: 4 }).map((_, c) => (
            <SolarPanelTile
              key={`${r}-${c}`}
              position={[c * 1.65 - 2.5, 0, r * 1.35 - 0.7]}
              intensity={solarIntensity}
            />
          ))
        )}

        <Text
          position={[0, 0.85, 0]}
          fontSize={0.38}
          color="#e2e8f0"
          anchorX="center"
          outlineWidth={0.04}
          outlineColor="#020617"
        >
          Solar Array
        </Text>
      </group>

      <RooftopUtilities />
    </group>
  );
}

function RoomPopup({
  selectedRoom,
  onClose,
  liveData,
  onToggle,
}: {
  selectedRoom: string;
  onClose: () => void;
  liveData: LiveData;
  onToggle: (room: string) => void;
}) {
  const data = useMemo(() => getRoomData(selectedRoom, liveData), [selectedRoom, liveData]);

  return (
    <div
      style={{
        position: "absolute",
        top: "24px",
        right: "24px",
        width: "340px",
        backgroundColor: "rgba(15,23,42,0.92)",
        border: `1px solid ${data.isActive ? "#10b981" : "#475569"}`,
        borderRadius: "16px",
        padding: "20px",
        color: "#f8fafc",
        zIndex: 30,
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "22px" }}>{selectedRoom}</h2>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#94a3b8",
            fontSize: "22px",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "13px", color: "#94a3b8" }}>Status</div>
        <div
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: data.isActive ? "#6ee7b7" : "#cbd5e1",
          }}
        >
          {data.status}
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "13px", color: "#94a3b8" }}>Power</div>
        <div style={{ fontSize: "32px", fontWeight: 700 }}>{data.power.toFixed(2)} W</div>
      </div>

      <div
        style={{
          background: "#1e293b",
          borderRadius: "10px",
          padding: "12px",
          marginBottom: "16px",
          fontSize: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ color: "#94a3b8" }}>Voltage</span>
          <span>{data.voltage.toFixed(2)} V</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ color: "#94a3b8" }}>Equivalent Current</span>
          <span>{data.current.toFixed(2)} A</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#94a3b8" }}>Predicted</span>
          <span>{data.predicted.toFixed(2)} W</span>
        </div>
      </div>

      <button
        onClick={() => onToggle(selectedRoom)}
        style={{
          width: "100%",
          padding: "14px",
          background: data.isActive ? "#ef4444" : "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        {data.isActive ? "TURN OFF" : "TURN ON"}
      </button>
    </div>
  );
}

export default function ElectricalBuildingDigitalTwin() {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<LiveData>(defaultLiveData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchESP32Data = async () => {
    try {
      const res = await fetch(`${BACKEND_API}/status`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setLiveData({
        groundFloorRoom: data.groundFloorRoom ?? false,
        firstFloorLab: data.firstFloorLab ?? false,
        secondFloorRoom: data.secondFloorRoom ?? false,
        solarVoltage: data.solarVoltage ?? 0,
        measuredCurrent: data.measuredCurrent ?? 0,
        estimatedCurrent: data.estimatedCurrent ?? 0,
        estimatedPower: data.estimatedPower ?? 0,
        groundFloorEquivalent: data.groundFloorEquivalent ?? 0,
        firstFloorEquivalent: data.firstFloorEquivalent ?? 0,
        secondFloorEquivalent: data.secondFloorEquivalent ?? 0,
      });

      setError(null);
    } catch (err) {
      setError("Simulator Offline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchESP32Data();
    const interval = setInterval(fetchESP32Data, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async (room: string) => {
    let route = "";
    if (room === "Ground Floor Room") {
      const nextState = !liveData.groundFloorRoom;
      setLiveData((prev) => ({ ...prev, groundFloorRoom: nextState }));
      route = nextState ? "/load1/on" : "/load1/off";
    } else if (room === "First Floor Lab") {
      const nextState = !liveData.firstFloorLab;
      setLiveData((prev) => ({ ...prev, firstFloorLab: nextState }));
      route = nextState ? "/load2/on" : "/load2/off";
    } else if (room === "Second Floor Room") {
      const nextState = !liveData.secondFloorRoom;
      setLiveData((prev) => ({ ...prev, secondFloorRoom: nextState }));
      route = nextState ? "/load3/on" : "/load3/off";
    }

    if (!route) return;

    try {
      await fetch(`${BACKEND_API}${route}`, { method: "GET" });
      await fetchESP32Data();
    } catch (err) {
      // Backend temporarily offline, keep optimistic toggle
    }
  };

  const connectionText = loading ? "Connecting..." : error ? error : "Connected (Simulation)";
  const connectionColor = error ? "#ef4444" : "#22c55e";

  return (
    <div className="w-full h-full min-h-[600px] flex flex-col relative rounded-2xl overflow-hidden bg-slate-950/60">
      {selectedRoom && (
        <RoomPopup
          selectedRoom={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          liveData={liveData}
          onToggle={handleToggle}
        />
      )}

      {/* Floating 3D Twin HUD Header */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700/60 shadow-lg pointer-events-none">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
        <div>
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">3D Building Digital Twin</h2>
          <p className="text-[10px] text-slate-400">Click any room to inspect & control loads</p>
        </div>
      </div>

      {/* Floating Quick Controls Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-2 bg-slate-900/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700/60 shadow-xl">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Grid Feed:</span>
          <span className="text-cyan-300 font-bold">{liveData.estimatedPower.toFixed(0)} W</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Solar:</span>
          <span className="text-amber-400 font-bold">{liveData.solarVoltage.toFixed(1)} V</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggle("Ground Floor Room")}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${
              liveData.groundFloorRoom 
                ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50 hover:bg-emerald-600/40' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            GF {liveData.groundFloorRoom ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => handleToggle("First Floor Lab")}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${
              liveData.firstFloorLab 
                ? 'bg-blue-600/30 text-blue-300 border-blue-500/50 hover:bg-blue-600/40' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            1F Lab {liveData.firstFloorLab ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => handleToggle("Second Floor Room")}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${
              liveData.secondFloorRoom 
                ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 hover:bg-purple-600/40' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            2F {liveData.secondFloorRoom ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="w-full h-full min-h-[600px] flex-grow relative">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [16, 12, 24], fov: 45 }}
          onPointerMissed={() => setSelectedRoom(null)}
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[20, 30, 20]} intensity={1.8} castShadow />
          <directionalLight position={[-20, 15, -20]} intensity={1.2} color="#38bdf8" />
          <pointLight position={[0, 15, 0]} intensity={1.0} />

          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.06}
            autoRotate={!selectedRoom}
            autoRotateSpeed={0.35}
            maxPolarAngle={Math.PI / 2 - 0.08}
            minDistance={12}
            maxDistance={50}
          />

          <BuildingModel
            selectedRoom={selectedRoom}
            setSelectedRoom={setSelectedRoom}
            liveData={liveData}
          />

          {/* Clean Floor Grid Plane aligned with building base at y = -4 */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.05, 0]} receiveShadow>
            <planeGeometry args={[120, 120]} />
            <shadowMaterial opacity={0.35} />
          </mesh>

          <gridHelper args={[80, 40, "#38bdf8", "#1e293b"]} position={[0, -4.04, 0]} />

          <ContactShadows
            position={[0, -4.02, 0]}
            opacity={0.65}
            scale={36}
            blur={2.8}
            far={5}
            color="#000000"
          />
        </Canvas>
      </div>
    </div>
  );
}