export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center">
      <style>
        {`
          .spinner {
            color: gray;
            display: inline-block;
            position: relative;
            width: 70px;
            height: 70px;
            transform: scale(0.3) translateX(-5px) translateY(-5px);
          }
          .spinner div {
            transform-origin: 40px 40px;
            animation: spinner 1.2s linear infinite;
          }
          .spinner div:after {
            content: " ";
            display: block;
            position: absolute;
            top: 5px;
            left: 37px;
            width: 6px;
            height: 20px;
            border-radius: 30%;
            background: black;
          }

          .dark .spinner {
            color: lightgray;
          }

          .dark .spinner div:after {
            background: #f0f0f0;
          }

          .spinner div:nth-child(1) {
            transform: rotate(0deg);
            animation-delay: -1.1s;
          }
          .spinner div:nth-child(2) {
            transform: rotate(30deg);
            animation-delay: -1s;
          }
          .spinner div:nth-child(3) {
            transform: rotate(60deg);
            animation-delay: -0.9s;
          }
          .spinner div:nth-child(4) {
            transform: rotate(90deg);
            animation-delay: -0.8s;
          }
          .spinner div:nth-child(5) {
            transform: rotate(120deg);
            animation-delay: -0.7s;
          }
          .spinner div:nth-child(6) {
            transform: rotate(150deg);
            animation-delay: -0.6s;
          }
          .spinner div:nth-child(7) {
            transform: rotate(180deg);
            animation-delay: -0.5s;
          }
          .spinner div:nth-child(8) {
            transform: rotate(210deg);
            animation-delay: -0.4s;
          }
          .spinner div:nth-child(9) {
            transform: rotate(240deg);
            animation-delay: -0.3s;
          }
          .spinner div:nth-child(10) {
            transform: rotate(270deg);
            animation-delay: -0.2s;
          }
          .spinner div:nth-child(11) {
            transform: rotate(300deg);
            animation-delay: -0.1s;
          }
          .spinner div:nth-child(12) {
            transform: rotate(330deg);
            animation-delay: 0s;
          }
          @keyframes spinner {
            0% {
              opacity: 1;
            }
            100% {
              opacity: 0.15;
            }
          }
        `}
      </style>
      <div className="spinner">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  );
}
