import turtle
import winsound
from winsound import *
wn=turtle.Screen()
wn.title('pingpong')
wn.bgcolor("black") 
wn.setup(width=800,height=600)
wn.tracer(0)

#Score
score_a=0
score_b=0

#paddle a
paddle_a=turtle.Turtle()
paddle_a.speed(0)
paddle_a.shape("square")
paddle_a.color("white")
paddle_a.penup()
paddle_a.goto(-350,0)
paddle_a.shapesize(stretch_wid=5,stretch_len=1)

#paddle b
paddle_b=turtle.Turtle()
paddle_b.speed(0)
paddle_b.shape("square")
paddle_b.color("white")
paddle_b.penup()
paddle_b.goto(350,0)
paddle_b.shapesize(stretch_wid=5,stretch_len=1)
#ball
ball=turtle.Turtle()
ball.speed(0)
ball.shape("circle")
ball.color("white")
ball.penup()
ball.goto(0,0)
ball.dx=0.2
ball.dy=-0.2
#pen
pen=turtle.Turtle()
pen.speed(0)
pen.color("white")
pen.penup()
pen.hideturtle()
pen.goto(0,260)
pen.write("Player A:0  Player B:0",align="center",font=("Courier",24,"normal"))

#function
def paddle_a_up():
    y=paddle_a.ycor()
    y+=20
    paddle_a.sety(y) 
def paddle_a_down():
    y=paddle_a.ycor()
    y-=20
    paddle_a.sety(y) 
    
def paddle_b_up():
    y=paddle_b.ycor()
    y+=20
    paddle_b.sety(y)
def paddle_b_down():
    y=paddle_b.ycor()
    y-=20
    paddle_b.sety(y)
#keyboard binding
wn.listen()
wn.onkeypress(paddle_a_up,"w")
wn.onkeypress(paddle_a_down,"s")
wn.onkeypress(paddle_b_up,"Up")
wn.onkeypress(paddle_b_down,"Down")
#main gameloop
while True:
    wn.update()
    
    
    #move ball
    ball.setx(ball.xcor()+ball.dx)
    ball.sety(ball.ycor()+ball.dy)

    #border checking for ball
    if ball.ycor()>290:
        ball.sety(290)
        #this will reverse the direction(dx*-1=-2) in the sense ball.dy will be decreased by 2 
        ball.dy*=-1
        # winsound.PlaySound("Bounce-SoundBible.wav",winsound.SND_ASYNC)
    
    elif ball.ycor()<-290:
        ball.sety(-290)
        ball.dy*=-1
        
    elif ball.xcor()>390:
        ball.goto(0,0)
        ball.dx*=-1
        score_a+=1
        pen.clear()
        pen.write("Player A:{}  Player B:{}".format(score_a,score_b),align="center",font=("Courier",24,"normal"))
    elif ball.xcor()<-390:
        ball.goto(0,0)
        ball.dx*=-1
        score_b+=1
        pen.clear()
        pen.write("Player A:{}  Player B:{}".format(score_a,score_b),align="center",font=("Courier",24,"normal"))
    #border checking for paddles
    if paddle_a.ycor()>250:
        paddle_a.sety(250)
    elif paddle_a.ycor()<-250:
        paddle_a.sety(-250)
    if paddle_b.ycor()>250:
        paddle_b.sety(250)
    elif paddle_b.ycor()<-250:
        paddle_b.sety(-250)
    #collision of ball and paddle
    if (ball.xcor()>330 and ball.xcor()<340 )and(ball.ycor()<paddle_b.ycor()+40 and ball.ycor()>paddle_b.ycor()-40):
        ball.setx(330)
        ball.dx*=-1
    elif (ball.xcor()<-330 and ball.xcor()>-340) and (ball.ycor()<paddle_a.ycor()+40 and ball.ycor()>paddle_b.ycor()-40):
        ball.setx(-330)
        ball.dx*=-1