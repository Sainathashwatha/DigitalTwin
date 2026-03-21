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

const ESP32_IP = "http://10.105.96.233";

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
  groundFloorRoom: false,
  firstFloorLab: false,
  secondFloorRoom: false,
  solarVoltage: 0,
  measuredCurrent: 0,
  estimatedCurrent: 0,
  estimatedPower: 0,
  groundFloorEquivalent: 0,
  firstFloorEquivalent: 0,
  secondFloorEquivalent: 0,
};

function getRoomData(label: string, liveData: LiveData) {
  if (label === "Ground Floor Room") {
    return {
      isActive: liveData.groundFloorRoom,
      voltage: liveData.solarVoltage,
      current: liveData.groundFloorEquivalent,
      power: liveData.groundFloorRoom
        ? liveData.solarVoltage * liveData.groundFloorEquivalent
        : 0,
      predicted: liveData.groundFloorRoom
        ? liveData.solarVoltage * liveData.groundFloorEquivalent * 1.05
        : 0,
      status: liveData.groundFloorRoom ? "ACTIVE" : "OFF",
    };
  }

  if (label === "First Floor Lab") {
    return {
      isActive: liveData.firstFloorLab,
      voltage: liveData.solarVoltage,
      current: liveData.firstFloorEquivalent,
      power: liveData.firstFloorLab
        ? liveData.solarVoltage * liveData.firstFloorEquivalent
        : 0,
      predicted: liveData.firstFloorLab
        ? liveData.solarVoltage * liveData.firstFloorEquivalent * 1.08
        : 0,
      status: liveData.firstFloorLab ? "ACTIVE" : "OFF",
    };
  }

  if (label === "Second Floor Room") {
    return {
      isActive: liveData.secondFloorRoom,
      voltage: liveData.solarVoltage,
      current: liveData.secondFloorEquivalent,
      power: liveData.secondFloorRoom
        ? liveData.solarVoltage * liveData.secondFloorEquivalent
        : 0,
      predicted: liveData.secondFloorRoom
        ? liveData.solarVoltage * liveData.secondFloorEquivalent * 1.1
        : 0,
      status: liveData.secondFloorRoom ? "ACTIVE" : "OFF",
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
      const res = await fetch(`${ESP32_IP}/status`, {
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
      console.error(err);
      setError("ESP32 connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchESP32Data();
    const id = setInterval(fetchESP32Data, 2000);
    return () => clearInterval(id);
  }, []);

  const handleToggle = async (room: string) => {
    try {
      let route = "";

      if (room === "Ground Floor Room") {
        route = liveData.groundFloorRoom ? "/load1/off" : "/load1/on";
      } else if (room === "First Floor Lab") {
        route = liveData.firstFloorLab ? "/load2/off" : "/load2/on";
      } else if (room === "Second Floor Room") {
        route = liveData.secondFloorRoom ? "/load3/off" : "/load3/on";
      }

      if (!route) return;

      const res = await fetch(`${ESP32_IP}${route}`, { method: "GET" });
      if (!res.ok) throw new Error(`Control failed ${res.status}`);

      await fetchESP32Data();
    } catch (err) {
      console.error(err);
      setError("Control failed");
    }
  };

  const connectionText = loading ? "Connecting..." : error ? error : "Connected";
  const connectionColor = error ? "#ef4444" : "#22c55e";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
            Electrical Building Digital Twin – Final
          </h1>
          <p className="text-lg opacity-80">3 loads • ESP32 live control • Solar monitoring</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 bg-gray-950/60 rounded-2xl border border-gray-700/50 p-4 shadow-2xl h-[70vh] min-h-[520px] relative overflow-hidden">
            {selectedRoom && (
              <RoomPopup
                selectedRoom={selectedRoom}
                onClose={() => setSelectedRoom(null)}
                liveData={liveData}
                onToggle={handleToggle}
              />
            )}

            <Canvas
              shadows
              dpr={[1, 1.8]}
              camera={{ position: [18, 14, 28], fov: 42 }}
              onPointerMissed={() => setSelectedRoom(null)}
            >
              <Environment preset="city" />
              <ambientLight intensity={0.26} />
              <spotLight
                position={[25, 35, 15]}
                angle={0.45}
                penumbra={1}
                intensity={3.2}
                color="#0ea5e9"
                castShadow
              />
              <directionalLight position={[-25, 8, -25]} intensity={2.2} color="#6366f1" />
              <directionalLight position={[0, 12, -25]} intensity={1.2} />

              <OrbitControls
                makeDefault
                enableDamping
                dampingFactor={0.06}
                autoRotate={!selectedRoom}
                autoRotateSpeed={0.35}
                maxPolarAngle={Math.PI / 2 - 0.08}
                minDistance={14}
                maxDistance={58}
              />

              <BuildingModel
                selectedRoom={selectedRoom}
                setSelectedRoom={setSelectedRoom}
                liveData={liveData}
              />

              <group position={[0, -4.02, 0]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                  <planeGeometry args={[180, 180]} />
                  <MeshReflectorMaterial
                    blur={[450, 120]}
                    resolution={512}
                    mixBlur={1.1}
                    mixStrength={18}
                    roughness={0.55}
                    depthScale={1.3}
                    minDepthThreshold={0.35}
                    maxDepthThreshold={1.5}
                    color="#020617"
                    metalness={0.85}
                    mirror={1}
                  />
                </mesh>
              </group>

              <ContactShadows
                position={[0, -4.01, 0]}
                opacity={0.85}
                scale={36}
                blur={2.8}
                far={5}
                color="#000000"
              />
            </Canvas>
          </div>

          <div className="bg-gray-950/70 rounded-2xl border border-gray-700/50 p-6 flex flex-col justify-between shadow-2xl">
            <div>
              <h2 className="text-2xl font-semibold mb-6">Live Status</h2>

              <div className="space-y-6">
                <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
                  <h3 className="text-lg font-medium mb-3">ESP32 Link</h3>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Status</span>
                    <span style={{ color: connectionColor }}>{connectionText}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Refresh</span>
                    <span>2 sec</span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
                  <h3 className="text-lg font-medium mb-3">Loads</h3>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Ground Floor Room</span>
                    <span style={{ color: liveData.groundFloorRoom ? "#22c55e" : "#94a3b8" }}>
                      {liveData.groundFloorRoom ? "ON" : "OFF"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">First Floor Lab</span>
                    <span style={{ color: liveData.firstFloorLab ? "#22c55e" : "#94a3b8" }}>
                      {liveData.firstFloorLab ? "ON" : "OFF"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Second Floor Room</span>
                    <span style={{ color: liveData.secondFloorRoom ? "#22c55e" : "#94a3b8" }}>
                      {liveData.secondFloorRoom ? "ON" : "OFF"}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
                  <h3 className="text-lg font-medium mb-3">Electrical</h3>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Solar Voltage</span>
                    <span>{liveData.solarVoltage.toFixed(2)} V</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Measured Current</span>
                    <span>{liveData.measuredCurrent.toFixed(3)} A</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Estimated Current</span>
                    <span>{liveData.estimatedCurrent.toFixed(2)} A</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Estimated Power</span>
                    <span>{liveData.estimatedPower.toFixed(2)} W</span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
                  <h3 className="text-lg font-medium mb-3">Quick Controls</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => handleToggle("Ground Floor Room")}
                      className="rounded-lg px-4 py-2 bg-blue-600 hover:bg-blue-500 transition"
                    >
                      Toggle Ground Floor Room
                    </button>
                    <button
                      onClick={() => handleToggle("First Floor Lab")}
                      className="rounded-lg px-4 py-2 bg-blue-600 hover:bg-blue-500 transition"
                    >
                      Toggle First Floor Lab
                    </button>
                    <button
                      onClick={() => handleToggle("Second Floor Room")}
                      className="rounded-lg px-4 py-2 bg-blue-600 hover:bg-blue-500 transition"
                    >
                      Toggle Second Floor Room
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-700 text-sm opacity-80">
              Click any room in the 3D model to open its control panel.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}