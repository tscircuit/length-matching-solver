import React from "react"

// Placement is rendered by core; capture.tsx runs the public Pipeline 9 solver.
export const usbInterfaceGapBoard = (
  <board
    width={30}
    height={16}
    schematicDisabled
    routingDisabled
    minTraceWidth={0.15}
    minTraceToPadEdgeClearance={0.15}
  >
    <chip
      name="J1"
      footprint="usbmicro"
      pcbX={-12.25}
      pcbRotation={270}
      pinLabels={{ pin2: "D_N", pin3: "D_P" }}
    />
    <chip
      name="U1"
      footprint="soic16"
      pcbX={8}
      pcbY={1.595}
      pinLabels={{ pin5: "D_N", pin6: "D_P" }}
    />
    <trace name="D_P" from="J1.D_P" to="U1.D_P" thickness={0.15} />
    <trace name="D_N" from="J1.D_N" to="U1.D_N" thickness={0.15} />
    <differentialpair
      positiveConnection="D_P"
      negativeConnection="D_N"
      pcbTraceGap={0.3}
      maxLengthSkew={0.1}
    />
    <pcbnotetext
      pcbY={-6.5}
      text="USB Micro-B to SOIC16: requested copper gap 0.30 mm"
      fontSize={0.6}
    />
  </board>
)
