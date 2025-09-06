import React from 'react'

const TypingDots = () => {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
    {[0, 1, 2].map(i => (
      <span
        key={i}
        style={{
          display: "inline-block",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "#888",
          animation: `typing-bounce 1s infinite`,
          animationDelay: `${i * 0.2}s`,
        }}
      />
    ))}
    <style>
      {`
        @keyframes typing-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
      `}
    </style>
  </div>
    </div>
  )
}

export default TypingDots
