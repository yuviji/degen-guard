"use client";
import { useEffect, useState } from "react";
import { ethers } from "ethers";

// Extend Window interface for MetaMask
declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function FundPage() {
  const [addr, setAddr] = useState<string>();
  const [status, setStatus] = useState<"awaiting" | "detected" | "active">("awaiting");
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string>();
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    fetch("/api/cdp/me", {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).then(r => {
      if (r.status === 401) {
        localStorage.removeItem('authToken');
        window.location.href = '/login';
        return;
      }
      return r.json();
    }).then(d => {
      if (d?.exists) setAddr(d.server.address);
    }).catch(err => {
      console.error('Failed to fetch wallet:', err);
    });
  }, []);

  useEffect(() => {
    if (!addr) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/cdp/${addr}/funding-status`);
      const { funded } = await r.json();
      if (funded) {
        setStatus("detected");
        clearInterval(t);
        setTimeout(() => {
          setStatus("active");
          window.location.href = "/dashboard";
        }, 1500);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [addr]);

  const connectMetaMask = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setUserAddress(address);
        setIsConnected(true);
      } else {
        alert('MetaMask is not installed. Please install MetaMask to continue.');
      }
    } catch (error) {
      console.error('Failed to connect MetaMask:', error);
    }
  };

  const sendETH = async () => {
    if (!isConnected || !addr) return;
    
    setIsTransferring(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Check current network
      const network = await provider.getNetwork();
      const baseChainId = 8453; // Base mainnet chain ID
      
      if (Number(network.chainId) !== baseChainId) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${baseChainId.toString(16)}` }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            // Chain not added, add Base network
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${baseChainId.toString(16)}`,
                chainName: 'Base',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org'],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }

      const transaction = {
        to: addr,
        value: ethers.parseEther("0.001"), // Send 0.001 ETH
      };

      const tx = await signer.sendTransaction(transaction);
      console.log('Transaction sent:', tx.hash);
      
      // Wait for transaction confirmation
      await tx.wait();
      console.log('Transaction confirmed');
      
      // Start polling for balance update
      setStatus("detected");
    } catch (error) {
      console.error('Transfer failed:', error);
      alert('Transfer failed. Please try again.');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Fund your Guardian wallet</h1>
      <p>Send a small amount of ETH on Base to this address:</p>
      <div className="p-3 rounded border font-mono break-all bg-gray-50">
        {addr ?? "Loading..."}
      </div>
      <p className="text-sm text-gray-500">Recommended: at least 0.001 ETH</p>
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${
          status === "awaiting" ? "bg-yellow-500" :
          status === "detected" ? "bg-green-500 animate-pulse" :
          "bg-green-600"
        }`}></div>
        <p className="text-sm">Status: {status}</p>
      </div>
      {status === "detected" && (
        <p className="text-green-600 text-sm">✓ Funding detected! Redirecting to dashboard...</p>
      )}
      
      {/* MetaMask Integration */}
      <div className="border-t pt-4 mt-6">
        <h3 className="text-lg font-medium mb-3">Quick Transfer with MetaMask</h3>
        
        {!isConnected ? (
          <button
            onClick={connectMetaMask}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Connect MetaMask
          </button>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              Connected: {userAddress?.slice(0, 6)}...{userAddress?.slice(-4)}
            </div>
            <button
              onClick={sendETH}
              disabled={isTransferring || !addr}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {isTransferring ? "Sending..." : "Send 0.001 ETH"}
            </button>
          </div>
        )}
        
        <p className="text-xs text-gray-500 mt-2">
          This will automatically switch to Base network and send ETH to your Guardian wallet.
        </p>
      </div>
    </div>
  );
}
