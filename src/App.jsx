import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import './App.css'

const ItemTypes = {
    PERSON: 'person',
}

document.title = 'ShareEat'
// OG image
const ogImage = document.createElement('meta')
ogImage.setAttribute('property', 'og:image')
ogImage.content = 'logo2.webp'
document.head.appendChild(ogImage)
// OG title
const ogTitle = document.createElement('meta')
ogTitle.setAttribute('property', 'og:title')
ogTitle.content = 'ShareEat'
document.head.appendChild(ogTitle)
// OG description
const ogDescription = document.createElement('meta')
ogDescription.setAttribute('property', 'og:description')
ogDescription.content = 'ShareEat is a simple app to split the bill between friends'
document.head.appendChild(ogDescription)

function Person({ name, id, avatar }) {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.PERSON,
        item: { id },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }))

    return (
        <div ref={drag} className="person" style={{ opacity: isDragging ? 0.5 : 1 }}>
            <img src={avatar} alt={name} className="avatar" />
            {name}
        </div>
    )
}

Person.propTypes = {
    name: PropTypes.string.isRequired,
    id: PropTypes.number.isRequired,
    avatar: PropTypes.string.isRequired,
}

function Dish({ name, id, icon, price, people, onDrop, onRemove }) {
    const [{ isOver }, drop] = useDrop(() => ({
        accept: ItemTypes.PERSON,
        drop: (item) => onDrop(item.id, id),
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }))

    return (
        <div ref={drop} className="dish" style={{ backgroundColor: isOver ? 'lightgreen' : 'white' }}>
            <img src={icon} alt={name} className="dish-icon" />
            <div>{name}</div>
            <div>₪{price.toFixed(2)}</div>
            <div className="dish-people">
                {people.map((person) => (
                    <div key={person.id} className="avatar-small-container">
                        <img src={person.avatar} alt={person.name} className="avatar-small" />
                        <button onClick={() => onRemove(person.id, id)}>Remove</button>
                    </div>
                ))}
            </div>
        </div>
    )
}

Dish.propTypes = {
    name: PropTypes.string.isRequired,
    id: PropTypes.number.isRequired,
    icon: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    people: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            name: PropTypes.string.isRequired,
            avatar: PropTypes.string.isRequired,
        })
    ).isRequired,
    onDrop: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
}

function App() {
    const [people] = useState([
        { id: 1, name: 'Shay', avatar: 'avatar2.jpg' },
        { id: 2, name: 'Eitan', avatar: 'avatar1.avif' },
    ])
    const [dishes, setDishes] = useState([
        { id: 1, name: 'Pizza', icon: 'pizza.png', price: 12.99, people: [] },
        { id: 2, name: 'Pasta', icon: 'pasta.webp', price: 10.99, people: [] },
    ])
    const [bill, setBill] = useState(null)
    const [total, setTotal] = useState(0)
    const [tipPercentage, setTipPercentage] = useState(12)
    const [totalWithTip, setTotalWithTip] = useState(null)
    const [isBillCalculated, setIsBillCalculated] = useState(false)


    useEffect(() => {
        calculateBill()
    }, [dishes, tipPercentage])

    const handleDrop = (personId, dishId) => {
        setDishes((prevDishes) =>
            prevDishes.map((dish) =>
                dish.id === dishId && !dish.people.some((p) => p.id === personId)
                    ? { ...dish, people: [...dish.people, people.find((p) => p.id === personId)] }
                    : dish
            )
        )
    }

    const handleRemove = (personId, dishId) => {
        setDishes((prevDishes) =>
            prevDishes.map((dish) =>
                dish.id === dishId
                    ? { ...dish, people: dish.people.filter((p) => p.id !== personId) }
                    : dish
            )
        )
    }

    const calculateBill = () => {
        const bill = people.reduce((acc, person) => {
            const total = dishes.reduce((sum, dish) => {
                const personCount = dish.people.length
                if (personCount > 0 && dish.people.some((p) => p.id === person.id)) {
                    return sum + dish.price / personCount
                }
                return sum
            }, 0)
            return { ...acc, [person.name]: total }
        }, {})

        const totalAmount = Object.values(bill).reduce((sum, amount) => sum + amount, 0)
        const unselectedDishesTotal = dishes.reduce((sum, dish) => {
            return dish.people.length === 0 ? sum + dish.price : sum
        }, 0)

        if (unselectedDishesTotal > 0) {
            const equalShare = unselectedDishesTotal / people.length
            people.forEach(person => {
                bill[person.name] += equalShare
            })
        }

        setBill(bill)
        setTotal(totalAmount + unselectedDishesTotal)
        calculateTip(tipPercentage, bill)
    }

    const calculateTip = (percentage, bill) => {
        setTipPercentage(percentage)
        const totalWithTip = Object.entries(bill).reduce((acc, [name, amount]) => {
            const tipAmount = amount * (percentage / 100)
            return { ...acc, [name]: (amount + tipAmount).toFixed(2) }
        }, {})
        setTotalWithTip(totalWithTip)
    }

    const handleCalculateBill = () => {
        calculateBill()
        setIsBillCalculated(true)
    }

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="app">
                {/*update the logo of the page*/}


                {/*logo*/}
                <img src="logo2.webp" alt="logo" className="logo" />
                <h2>Drag people to dishes they had</h2>
                <div className="people">
                    {people.map((person) => (
                        <Person key={person.id} id={person.id} name={person.name} avatar={person.avatar} />
                    ))}
                </div>
                <div className="dishes">
                    {dishes.map((dish) => (
                        <Dish key={dish.id} id={dish.id} name={dish.name} icon={dish.icon} price={dish.price} people={dish.people} onDrop={handleDrop} onRemove={handleRemove} />
                    ))}
                </div>
                <button className="calculate-button" onClick={handleCalculateBill}>Calculate Bill</button>
                <div>
                    <h3>Tip Options</h3>
                    {[12, 15, 18].map((percentage) => (
                        <button
                            key={percentage}
                            className={tipPercentage === percentage ? 'selected' : ''}
                            onClick={() => setTipPercentage(percentage)}
                        >
                            {percentage}% Tip
                        </button>
                    ))}
                </div>
                {isBillCalculated && bill && (
                    <div className="bill-display">
                        <h2>Bill</h2>
                        <ul>
                            {Object.entries(bill).map(([name, amount]) => (
                                <li key={name}>{name}: ₪{amount.toFixed(2)}</li>
                            ))}
                        </ul>
                        <div>Total: ₪{total.toFixed(2)}</div>
                        {totalWithTip && (
                            <div className="tip-display">
                                <h3>Total with Tip:</h3>
                                <ul>
                                    {Object.entries(totalWithTip).map(([name, amount]) => (
                                        <li key={name}>{name}: ₪{amount}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
                {/*<div className="state-display">*/}
                {/*    <h2>Current State</h2>*/}
                {/*    <pre>{JSON.stringify({ people, dishes }, null, 2)}</pre>*/}
                {/*</div>*/}
            </div>
        </DndProvider>
    )
}

export default App