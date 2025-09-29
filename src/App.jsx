import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, User, Bot, Wifi, WifiOff } from 'lucide-react';

const ChatApp = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [clientId, setClientId] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Parse one or many <contact> XML-like snippets into structured objects
  const parseContacts = (text) => {
    if (typeof text !== 'string') return [];
    const blocks = text.match(/<contact>[\s\S]*?<\/contact>/gi) || [];
    const extractFromBlock = (block, tagVariants) => {
      for (const tag of tagVariants) {
        const m = block.match(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'i'));
        if (m) {
          return m[0]
            .replace(new RegExp(`^<${tag}>`, 'i'), '')
            .replace(new RegExp(`<\\/${tag}>$`, 'i'), '')
            .trim();
        }
      }
      return '';
    };

    return blocks.map((block) => {
      const fullName = extractFromBlock(block, ['fullName', 'full_name']);
      const companyName = extractFromBlock(block, ['companyName', 'company_name']);
      const jobTitle = extractFromBlock(block, ['jobTitle', 'job_title']);
      const linkedInURL = extractFromBlock(block, ['linkedInURL', 'linkedin_url', 'linkedInURL'.toLowerCase()]);
      return { fullName, companyName, jobTitle, linkedInURL };
    }).filter(c => c.fullName || c.companyName || c.jobTitle || c.linkedInURL);
  };

  // Generate a random client ID
  const generateClientId = () => {
    return Math.random().toString(36).substring(2, 10);
  };

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Connect to WebSocket
  const connectWebSocket = () => {
    const newClientId = generateClientId();
    setClientId(newClientId);
    
    const wsUrl = `ws://localhost:8001/ws/${newClientId}`;
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log('Connected to WebSocket');
      setConnectionStatus('connected');
      setMessages(prev => [...prev, {
        type: 'system',
        content: `Connected as client: ${newClientId}`,
        timestamp: new Date()
      }]);
    };

    newSocket.onmessage = (event) => {
      console.log('Received message:', event.data);
      setIsTyping(false);
      
      // Try to parse JSON message, fallback to plain text
      let messageContent = event.data;
      let messageType = 'bot';
      try {
        const parsedMessage = JSON.parse(event.data);
        // If server labels messages with a type, respect it
        if (parsedMessage.type) {
          messageType = parsedMessage.type;
        }
        if (parsedMessage.message) {
          messageContent = parsedMessage.message;
        } else if (parsedMessage.content) {
          messageContent = parsedMessage.content;
        } else if (typeof parsedMessage === 'string') {
          messageContent = parsedMessage;
        }
      } catch (e) {
        // If it's not JSON, use the raw message
        messageContent = event.data;
      }
      
      // Do not echo back user messages received from server
      if (messageType === 'user') {
        return;
      }

      // If message contains <contact> block(s), render each as a dedicated card
      const contacts = parseContacts(messageContent);
      if (contacts.length > 0) {
        setMessages(prev => [
          ...prev,
          ...contacts.map(contact => ({ type: 'contact', contact, timestamp: new Date() }))
        ]);
        return; // do not also add raw text
      }
      
      setMessages(prev => [...prev, {
        type: 'bot',
        content: messageContent,
        timestamp: new Date()
      }]);
    };

    newSocket.onclose = () => {
      console.log('WebSocket connection closed');
      setConnectionStatus('disconnected');
      setMessages(prev => [...prev, {
        type: 'system',
        content: 'Disconnected from server',
        timestamp: new Date()
      }]);
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
      setMessages(prev => [...prev, {
        type: 'system',
        content: 'Connection error occurred',
        timestamp: new Date()
      }]);
    };

    setSocket(newSocket);
  };

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    if (socket) {
      socket.close();
      setSocket(null);
    }
  };

  // Send message
  const sendMessage = () => {
    if (!inputMessage.trim() || !socket || connectionStatus !== 'connected') {
      return;
    }

    // Add user message to chat
    setMessages(prev => [...prev, {
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    }]);

    // Send message to server
    socket.send(inputMessage);
    
    // Show typing indicator
    setIsTyping(true);
    
    // Clear input
    setInputMessage('');
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Get connection status color
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500';
      case 'disconnected': return 'text-red-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-t-2xl shadow-lg border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-full">
                <MessageCircle className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Agent Chat</h1>
                <p className="text-gray-600">Connect with your AI assistant</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {connectionStatus === 'connected' ? (
                  <Wifi className={getStatusColor()} size={20} />
                ) : (
                  <WifiOff className={getStatusColor()} size={20} />
                )}
                <span className={`text-sm font-medium ${getStatusColor()}`}>
                  {connectionStatus === 'connected' ? 'Connected' : 
                   connectionStatus === 'disconnected' ? 'Disconnected' : 'Error'}
                </span>
              </div>
              
              {/* Connection Button */}
              {connectionStatus === 'connected' ? (
                <button
                  onClick={disconnectWebSocket}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={connectWebSocket}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
          
          {/* Client ID */}
          {clientId && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Client ID: </span>
              <span className="text-sm font-mono text-gray-800">{clientId}</span>
            </div>
          )}
        </div>

        {/* Messages Container */}
        <div className="bg-white shadow-lg h-96 overflow-y-auto">
          <div className="p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="mx-auto text-gray-300 mb-4" size={48} />
                <p className="text-gray-500">No messages yet. Start a conversation!</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-xs lg:max-w-md ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.type === 'user' ? 'bg-blue-500' : 
                      message.type === 'bot' ? 'bg-purple-500' : message.type === 'contact' ? 'bg-purple-500' : 'bg-gray-500'
                    }`}>
                      {message.type === 'user' ? (
                        <User className="text-white" size={16} />
                      ) : message.type === 'bot' ? (
                        <Bot className="text-white" size={16} />
                      ) : message.type === 'contact' ? (
                        <Bot className="text-white" size={16} />
                      ) : (
                        <MessageCircle className="text-white" size={16} />
                      )}
                    </div>
                    
                    {/* Message Bubble */}
                    {message.type !== 'contact' ? (
                      <div className={`rounded-2xl px-4 py-2 ${
                        message.type === 'user' ? 'bg-blue-500 text-white' : 
                        message.type === 'bot' ? 'bg-gray-100 text-gray-900' : 
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.type === 'user' ? 'text-blue-100' : 
                          message.type === 'bot' ? 'text-gray-500' : 'text-yellow-600'
                        }`}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl px-4 py-3 bg-white border border-gray-200 shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900">{message.contact.fullName || '—'}</span>
                          <span className="text-xs text-gray-600">{message.contact.jobTitle || '—'}</span>
                          <span className="text-xs text-gray-600">{message.contact.companyName || '—'}</span>
                          {message.contact.linkedInURL && (
                            <a
                              href={message.contact.linkedInURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 mt-2 underline"
                            >
                              View LinkedIn Profile
                            </a>
                          )}
                          <span className="text-[10px] text-gray-400 mt-1">{formatTime(message.timestamp)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-xs lg:max-w-md">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                    <Bot className="text-white" size={16} />
                  </div>
                  <div className="bg-gray-100 rounded-2xl px-4 py-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-b-2xl shadow-lg border-t border-gray-200 p-6">
          <div className="flex gap-4">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              rows="2"
              disabled={connectionStatus !== 'connected'}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || connectionStatus !== 'connected'}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 font-medium"
            >
              <Send size={18} />
              Send
            </button>
          </div>
          
          {connectionStatus !== 'connected' && (
            <p className="text-sm text-gray-500 mt-2">
              Please connect to start chatting
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatApp;
