import React from 'react';

/**
 * Linien-Icon der Reiseenduro aus dem App-Emblem (hohe Scheibe, Schnabel, Tank, Sitzbank).
 * API wie lucide-react, damit es sich nahtlos zwischen die übrigen Icons einfügt.
 */
export default function MotorbikeIcon({ size = 24, strokeWidth = 2, className, ...rest }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
            {...rest}
        >
            <circle cx="5" cy="17" r="3" />
            <circle cx="19" cy="17" r="3" />
            <path d="M2.5 10.5H8l2-2h4.5l3.5 3.5h-4l-1.5 3.5H9.5L8 10.5" />
            <path d="M14.5 8.5 15.5 4h1.5" />
            <path d="M16.5 12l2.5 5" />
            <path d="M5 17l4.5-1.5" />
        </svg>
    );
}
