import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export default function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div className={`
      bg-white rounded-xl shadow-md p-6
      ${hover ? 'hover:shadow-xl transition-shadow duration-200' : ''}
      ${className}
    `}>
      {children}
    </div>
  )
}

