"use client"

import { cn } from "@/lib/utils"

export function RobotArmVisual({ isOn }: { isOn: boolean }) {
  return (
    <div className="relative w-48 h-48 flex items-end justify-center">
      {/* Base */}
      <div className="w-24 h-4 bg-slate-700 rounded-t-lg z-10" />
      
      {/* Lower Arm */}
      <div 
        className={cn(
          "absolute bottom-4 left-1/2 w-3 h-24 bg-orange-500 origin-bottom rounded-full border-2 border-slate-800 transition-transform duration-[2000ms] ease-in-out",
          isOn ? "animate-[swing_3s_infinite_alternate]" : "rotate-0"
        )}
        style={{ transformOrigin: '50% 100%' }}
      >
        {/* Joint */}
        <div className="absolute -top-1 -left-1 w-5 h-5 bg-slate-600 rounded-full border border-slate-400" />
        
        {/* Upper Arm */}
        <div 
          className={cn(
            "absolute top-0 left-1/2 w-2 h-20 bg-orange-400 origin-top rounded-full border-2 border-slate-800 -translate-x-1/2",
            isOn ? "animate-[swing_2s_infinite_alternate-reverse]" : "rotate-45"
          )}
        >
            {/* Gripper */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-6 h-6 border-b-4 border-l-4 border-r-4 border-slate-800 rounded-b-lg" />
        </div>
      </div>

      {/* Status Light */}
      <div className={cn(
        "absolute top-10 right-10 w-4 h-4 rounded-full border border-slate-600 shadow-lg transition-all duration-500",
        isOn ? "bg-green-500 shadow-green-500/50" : "bg-red-500"
      )} />
      
      <style jsx>{`
        @keyframes swing {
          0% { transform: rotate(-15deg); }
          100% { transform: rotate(15deg); }
        }
      `}</style>
    </div>
  )
}

export function ConveyorVisual({ isOn }: { isOn: boolean }) {
  return (
    <div className="relative w-64 h-32 flex flex-col items-center justify-center">
      {/* Belt Container */}
      <div className="relative w-full h-12 bg-slate-800 rounded-full border-4 border-slate-600 overflow-hidden flex items-center">
        {/* Moving Belt Pattern */}
        <div className={cn(
            "flex w-[200%] h-full items-center space-x-8",
            isOn ? "animate-conveyor" : ""
        )}>
            {[...Array(12)].map((_, i) => (
                <div key={i} className="w-2 h-full bg-slate-600/50 skew-x-12" />
            ))}
        </div>
      </div>

      {/* Legs */}
      <div className="flex justify-between w-4/5 mt-[-2px]">
        <div className="w-4 h-16 bg-slate-500" />
        <div className="w-4 h-16 bg-slate-500" />
      </div>

      {/* Status Indicator */}
      <div className={cn(
        "absolute top-0 right-0 w-3 h-3 rounded-full transition-colors duration-300",
        isOn ? "bg-green-400 animate-pulse" : "bg-red-500"
      )} />

      <style jsx global>{`
        @keyframes conveyor {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-conveyor {
          animation: conveyor 1s linear infinite;
        }
      `}</style>
    </div>
  )
}