import React, { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', color: 'white', background: '#121212', minHeight: '100vh' }}>
                    <h1 style={{ color: '#ff4d4f' }}>Hoppla, ein Fehler ist aufgetreten.</h1>
                    <p>Bitte lade die Seite neu oder versuche es später noch einmal.</p>
                    <details style={{ marginTop: '1rem', color: '#666', whiteSpace: 'pre-wrap' }}>
                        <summary>Details anzeigen</summary>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '1rem',
                            padding: '10px 20px',
                            background: 'var(--kawasaki-green)',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Seite neu laden
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
